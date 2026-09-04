// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title WORKToken
 * @dev WorkLedger Non-Monetary Capability Token (ERC-20 Audit Anchor).
 * 
 * System Architecture:
 * - WorkLedger is a non-monetary proof-of-work verification layer.
 * - WORK tokens represent verified capability and pedagogical claim-checks.
 * - This contract anchors state changes (mints, loans, and monthly salary sweeps)
 *   to an immutable EVM blockchain without touching statutory fiat payroll.
 *
 * Security Enhancements & Fixes Applied:
 * - [MVGR-01] Configurable salaryPoolVault in storage with explicit setter and event.
 *             Prevents arbitrary confiscation by finance admin to unvetted addresses.
 * - [MVGR-02] Cryptographic replay protection for proof rewards (processedProofs mapping)
 *             and emergency loan issuances (processedLoans mapping).
 * - [MVGR-03] True atomic batch reversal: Reverts on any zero/insufficient balance, zero address,
 *             or self-sweep. Added processedBatches mapping and MAX_BATCH_SIZE guard.
 * - [MVGR-04] Two-step Director rotation pattern (proposeDirector & acceptDirector).
 * - [MVGR-05] Explicit check against self-sweeps (account != salaryPoolVault) and centralized _transfer.
 * - [MVGR-06] Added increaseAllowance and decreaseAllowance to mitigate standard approval race.
 * - [Additional] Emergency pause/unpause mechanism and accurate event logs.
 */

interface IERC20 {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

interface IERC20Metadata is IERC20 {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
}

contract WORKToken is IERC20Metadata {
    // Token Identity
    string private constant _name = "WorkLedger Capability Token";
    string private constant _symbol = "WORK";
    uint8 private constant _decimals = 18;
    bool public constant isNonMonetary = true;

    // Safety Bounds
    uint256 public constant MAX_BATCH_SIZE = 250;

    // Balances & Allowances
    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    // Role Access Control & Configuration
    address public director;
    address public pendingDirector;
    address public financeAdmin;
    address public salaryPoolVault;
    mapping(address => bool) public isRelayer;

    // Emergency Controls
    bool public paused;

    // Replay Protection Mappings
    mapping(bytes32 => bool) public processedProofs;
    mapping(bytes32 => bool) public processedLoans;
    mapping(bytes32 => bool) public processedBatches;

    // Enterprise Audit Events
    event MintRecorded(
        address indexed recipient,
        uint256 amount,
        string taskId,
        bytes32 indexed proofHash
    );

    event BatchReversalExecuted(
        address indexed executor,
        address indexed salaryPoolVault,
        uint256 totalSwept,
        bytes32 indexed batchId
    );

    event LoanIssued(
        address indexed borrower,
        uint256 amount,
        string loanId,
        bytes32 indexed loanKey
    );

    event RoleUpdated(string role, address indexed account, bool enabled);
    event DirectorTransferProposed(address indexed currentDirector, address indexed proposedDirector);
    event DirectorTransferred(address indexed previousDirector, address indexed newDirector);
    event FinanceAdminUpdated(address indexed previousAdmin, address indexed newAdmin);
    event SalaryPoolVaultUpdated(address indexed previousVault, address indexed newVault);
    event Paused(address indexed account);
    event Unpaused(address indexed account);

    modifier onlyDirector() {
        require(msg.sender == director, "WORKToken: caller is not Director");
        _;
    }

    modifier onlyFinance() {
        require(msg.sender == financeAdmin || msg.sender == director, "WORKToken: caller is not Finance");
        _;
    }

    modifier onlyRelayer() {
        require(isRelayer[msg.sender] || msg.sender == director, "WORKToken: caller is not authorized relayer");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "WORKToken: contract is paused");
        _;
    }

    constructor(
        address _director,
        address _financeAdmin,
        address _relayer,
        address _salaryPoolVault
    ) {
        require(_director != address(0), "WORKToken: invalid director");
        director = _director;
        financeAdmin = _financeAdmin != address(0) ? _financeAdmin : _director;
        salaryPoolVault = _salaryPoolVault != address(0) ? _salaryPoolVault : _director;

        if (_relayer != address(0)) {
            isRelayer[_relayer] = true;
            emit RoleUpdated("RELAYER", _relayer, true);
        }
        
        emit RoleUpdated("DIRECTOR", _director, true);
        emit RoleUpdated("FINANCE_ADMIN", financeAdmin, true);
        emit SalaryPoolVaultUpdated(address(0), salaryPoolVault);

        // Initial Treasury Vault Allocation (1,000,000 WORK)
        _mint(_director, 1_000_000 * 10**uint256(_decimals));
    }

    // --- ERC-20 Standard Metadata ---
    function name() external pure override returns (string memory) {
        return _name;
    }

    function symbol() external pure override returns (string memory) {
        return _symbol;
    }

    function decimals() external pure override returns (uint8) {
        return _decimals;
    }

    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 value) public override whenNotPaused returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function allowance(address owner, address spender) external view override returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 value) external override returns (bool) {
        _approve(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external override whenNotPaused returns (bool) {
        uint256 currentAllowance = _allowances[from][msg.sender];
        require(currentAllowance >= value, "WORKToken: insufficient allowance");
        unchecked {
            _approve(from, msg.sender, currentAllowance - value);
        }
        _transfer(from, to, value);
        return true;
    }

    // --- MVGR-06 Fix: Safe Allowance Extensions ---
    function increaseAllowance(address spender, uint256 addedValue) public returns (bool) {
        _approve(msg.sender, spender, _allowances[msg.sender][spender] + addedValue);
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) public returns (bool) {
        uint256 currentAllowance = _allowances[msg.sender][spender];
        require(currentAllowance >= subtractedValue, "WORKToken: decreased allowance below zero");
        unchecked {
            _approve(msg.sender, spender, currentAllowance - subtractedValue);
        }
        return true;
    }

    // --- Role-Restricted Enterprise Operations ---

    /**
     * @notice Mint verified proof of work rewards to a faculty member's personal wallet.
     * @dev MVGR-02 Fix: Enforces unique proofHash replay prevention.
     */
    function mintProofReward(
        address recipient,
        uint256 amount,
        string calldata taskId,
        bytes32 proofHash
    ) external onlyRelayer whenNotPaused returns (bool) {
        require(recipient != address(0), "WORKToken: mint to zero address");
        require(amount > 0, "WORKToken: mint amount must be greater than zero");
        require(proofHash != bytes32(0), "WORKToken: invalid proof hash");
        require(!processedProofs[proofHash], "WORKToken: proof already processed");

        processedProofs[proofHash] = true;
        _mint(recipient, amount);
        emit MintRecorded(recipient, amount, taskId, proofHash);
        return true;
    }

    /**
     * @notice Issue work-loan deficit advances from the emergency treasury pool.
     * @dev MVGR-02 Fix: Enforces unique loanId replay prevention.
     */
    function issueWorkLoan(
        address borrower,
        uint256 amount,
        string calldata loanId
    ) external onlyDirector whenNotPaused returns (bool) {
        require(borrower != address(0), "WORKToken: zero borrower address");
        require(amount > 0, "WORKToken: loan amount must be greater than zero");
        bytes32 loanKey = keccak256(abi.encodePacked(loanId));
        require(loanKey != bytes32(0), "WORKToken: invalid loan identifier");
        require(!processedLoans[loanKey], "WORKToken: loan already processed");

        processedLoans[loanKey] = true;
        _mint(borrower, amount);
        emit LoanIssued(borrower, amount, loanId, loanKey);
        return true;
    }

    /**
     * @notice Execute atomic batch reversal: sweeps token balances back to the configured SALARY_POOL vault.
     * @dev MVGR-01, MVGR-03, MVGR-05 Fixes:
     *      - Destination constrained to configured salaryPoolVault storage variable.
     *      - All-or-nothing atomicity: reverts if any entry is invalid or underfunded.
     *      - Prevents self-sweeps and duplicate/replayed batch executions.
     */
    function executeBatchReversal(
        address[] calldata accounts,
        uint256[] calldata amounts,
        bytes32 batchId
    ) external onlyFinance whenNotPaused returns (bool) {
        require(batchId != bytes32(0), "WORKToken: invalid batch ID");
        require(!processedBatches[batchId], "WORKToken: batch already processed");
        require(accounts.length == amounts.length, "WORKToken: array length mismatch");
        require(accounts.length > 0 && accounts.length <= MAX_BATCH_SIZE, "WORKToken: invalid batch size");

        address vault = salaryPoolVault;
        require(vault != address(0), "WORKToken: salary pool vault not configured");

        processedBatches[batchId] = true;
        uint256 totalSwept = 0;

        for (uint256 i = 0; i < accounts.length; i++) {
            address account = accounts[i];
            uint256 amount = amounts[i];
            
            require(account != address(0), "WORKToken: zero account");
            require(account != vault, "WORKToken: source equals vault");
            require(amount > 0, "WORKToken: zero amount in batch");
            require(_balances[account] >= amount, "WORKToken: insufficient balance for reversal");

            _transfer(account, vault, amount);
            totalSwept += amount;
        }

        emit BatchReversalExecuted(msg.sender, vault, totalSwept, batchId);
        return true;
    }

    // --- MVGR-04 Fix: Two-Step Director Rotation ---

    function proposeDirector(address newDirector) external onlyDirector {
        require(newDirector != address(0), "WORKToken: zero new director address");
        require(newDirector != director, "WORKToken: cannot propose current director");
        pendingDirector = newDirector;
        emit DirectorTransferProposed(director, newDirector);
    }

    function acceptDirector() external {
        require(msg.sender == pendingDirector, "WORKToken: caller is not pending director");
        address previousDirector = director;
        director = pendingDirector;
        pendingDirector = address(0);
        emit DirectorTransferred(previousDirector, director);
        emit RoleUpdated("DIRECTOR", director, true);
    }

    // --- Admin Role & Configuration ---

    function setSalaryPoolVault(address newVault) external onlyDirector {
        require(newVault != address(0), "WORKToken: invalid vault address");
        address previousVault = salaryPoolVault;
        salaryPoolVault = newVault;
        emit SalaryPoolVaultUpdated(previousVault, newVault);
    }

    function setFinanceAdmin(address newFinanceAdmin) external onlyDirector {
        require(newFinanceAdmin != address(0), "WORKToken: zero finance admin address");
        address previousAdmin = financeAdmin;
        financeAdmin = newFinanceAdmin;
        emit FinanceAdminUpdated(previousAdmin, newFinanceAdmin);
        emit RoleUpdated("FINANCE_ADMIN", newFinanceAdmin, true);
    }

    function setRelayer(address relayer, bool enabled) external onlyDirector {
        require(relayer != address(0), "WORKToken: zero relayer address");
        isRelayer[relayer] = enabled;
        emit RoleUpdated("RELAYER", relayer, enabled);
    }

    // --- Emergency Pause Controls ---

    function pause() external onlyDirector {
        require(!paused, "WORKToken: already paused");
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyDirector {
        require(paused, "WORKToken: not paused");
        paused = false;
        emit Unpaused(msg.sender);
    }

    // --- Internal Helpers ---

    function _transfer(address from, address to, uint256 value) internal {
        require(from != address(0), "WORKToken: transfer from zero address");
        require(to != address(0), "WORKToken: transfer to zero address");
        require(_balances[from] >= value, "WORKToken: transfer amount exceeds balance");

        _balances[from] -= value;
        _balances[to] += value;
        emit Transfer(from, to, value);
    }

    function _mint(address account, uint256 value) internal {
        require(account != address(0), "WORKToken: mint to zero address");
        _totalSupply += value;
        _balances[account] += value;
        emit Transfer(address(0), account, value);
    }

    function _approve(address owner, address spender, uint256 value) internal {
        require(owner != address(0), "WORKToken: approve from zero address");
        require(spender != address(0), "WORKToken: approve to zero address");
        _allowances[owner][spender] = value;
        emit Approval(owner, spender, value);
    }
}
