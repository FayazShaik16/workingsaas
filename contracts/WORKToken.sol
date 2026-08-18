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

    // Balances & Allowances
    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    // Role Access Control
    address public director;
    address public financeAdmin;
    mapping(address => bool) public isRelayer;

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
        string loanId
    );

    event RoleUpdated(string role, address indexed account, bool enabled);

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

    constructor(address _director, address _financeAdmin, address _relayer) {
        require(_director != address(0), "WORKToken: invalid director");
        director = _director;
        financeAdmin = _financeAdmin != address(0) ? _financeAdmin : _director;
        if (_relayer != address(0)) {
            isRelayer[_relayer] = true;
        }
        
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

    function transfer(address to, uint256 value) public override returns (bool) {
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

    function transferFrom(address from, address to, uint256 value) external override returns (bool) {
        uint256 currentAllowance = _allowances[from][msg.sender];
        require(currentAllowance >= value, "WORKToken: insufficient allowance");
        unchecked {
            _approve(from, msg.sender, currentAllowance - value);
        }
        _transfer(from, to, value);
        return true;
    }

    // --- Role-Restricted Enterprise Operations ---

    /**
     * @notice Mint verified proof of work rewards to a faculty member's personal wallet.
     */
    function mintProofReward(
        address recipient,
        uint256 amount,
        string calldata taskId,
        bytes32 proofHash
    ) external onlyRelayer returns (bool) {
        require(recipient != address(0), "WORKToken: mint to zero address");
        _mint(recipient, amount);
        emit MintRecorded(recipient, amount, taskId, proofHash);
        return true;
    }

    /**
     * @notice Issue work-loan deficit advances from the emergency treasury pool.
     */
    function issueWorkLoan(
        address borrower,
        uint256 amount,
        string calldata loanId
    ) external onlyDirector returns (bool) {
        require(borrower != address(0), "WORKToken: zero borrower address");
        _mint(borrower, amount);
        emit LoanIssued(borrower, amount, loanId);
        return true;
    }

    /**
     * @notice Execute atomic batch reversal: sweeps token balances back to the Director's SALARY_POOL vault.
     */
    function executeBatchReversal(
        address[] calldata accounts,
        uint256[] calldata amounts,
        address salaryPoolVault,
        bytes32 batchId
    ) external onlyFinance returns (bool) {
        require(accounts.length == amounts.length, "WORKToken: array length mismatch");
        require(salaryPoolVault != address(0), "WORKToken: invalid vault address");

        uint256 totalSwept = 0;
        for (uint256 i = 0; i < accounts.length; i++) {
            address account = accounts[i];
            uint256 amount = amounts[i];
            
            if (amount > 0 && _balances[account] >= amount) {
                _balances[account] -= amount;
                _balances[salaryPoolVault] += amount;
                emit Transfer(account, salaryPoolVault, amount);
                totalSwept += amount;
            }
        }

        emit BatchReversalExecuted(msg.sender, salaryPoolVault, totalSwept, batchId);
        return true;
    }

    // --- Admin Role Configuration ---

    function setRelayer(address relayer, bool enabled) external onlyDirector {
        require(relayer != address(0), "WORKToken: zero relayer");
        isRelayer[relayer] = enabled;
        emit RoleUpdated("RELAYER", relayer, enabled);
    }

    function setFinanceAdmin(address _financeAdmin) external onlyDirector {
        require(_financeAdmin != address(0), "WORKToken: zero finance admin");
        financeAdmin = _financeAdmin;
        emit RoleUpdated("FINANCE_ADMIN", _financeAdmin, true);
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
