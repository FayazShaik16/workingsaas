# Core Flow Verification & Architecture Audit Matrix

This document provides complete technical verification of all routes, APIs, source database tables, and on-chain integrations for the **WorkLedger** platform.

---

## 1. Verified Screen & API Inventory

| Step | User Role | Screen Route | Primary API Endpoint | Source DB Tables & Actions |
|---|---|---|---|---|
| **1** | `SYSTEM_ADMIN` | `/[orgId]/config/departments` | `GET /api/admin/departments`, `POST /api/admin/departments` | `public.org_units` (Stores real departments, filtered strictly by `organization_id`) |
| **2** | `SYSTEM_ADMIN` | `/[orgId]/config/people` | `POST /api/admin/create-user` | `public.users`, `public.user_roles`, `public.roles` |
| **3** | `SYSTEM_ADMIN` | `/[orgId]/config/import` | `POST /api/admin/bulk-import-users` | Bulk `auth.users`, `public.users`, `public.org_units`, `public.user_roles` |
| **4** | `DEPT_ADMIN` | `/[orgId]/dept-admin/import` | `POST /api/dept-admin/import-schedule` | `public.scheduled_work_templates`, `public.scheduled_work_instances` |
| **5** | `MEMBER` | `/[orgId]/member` | `POST /api/member/complete-scheduled` | `public.scheduled_work_instances`, `public.scheduled_work_completions`, `public.credit_ledger_entries`, `public.monthly_work_progress` |
| **6** | `MEMBER` | `/[orgId]/member/marketplace` | `POST /api/tasks/nominate` | `public.tasks`, `public.nominations` |
| **7** | `ORG_UNIT_LEAD` | `/[orgId]/lead/nominations` | `POST /api/tasks/assign`, `POST /api/tasks/reject-nomination` | `public.nominations`, `public.tasks` |
| **8** | `ORG_UNIT_LEAD` | `/[orgId]/lead/tasks` | `POST /api/lead/approve-proof`, `POST /api/lead/reject-proof` | `public.task_proofs`, `public.tasks`, `public.credit_ledger_entries` |
| **9** | `ORG_UNIT_LEAD` | `/[orgId]/lead/salary` | `POST /api/lead/endorse-salary` | `public.salary_requests` |
| **10** | `FINANCE_ADMIN` | `/[orgId]/finance/salary` | `POST /api/finance/settle-salary` | `public.salary_requests`, `public.blockchain_transactions`, `contracts/WorkLedgerToken.sol` (`mint`) |
| **11** | `MEMBER` | `/[orgId]/member/wallet` | `GET /api/wallets/me`, `POST /api/wallets/me` | `public.blockchain_wallets`, `contract.balanceOf()` (Live Sepolia) |
| **12** | `DIRECTOR` / `ADMIN` | `/[orgId]/config/blockchain` | `GET /api/blockchain/status` | Real Sepolia RPC, Contract Bytecode verification, Treasury ETH balance |

---

## 2. Shared Progress Formula Specification

All progress visualizations across Member, HOD, and Director consoles evaluate the uniform server-side formula:

$$\text{Scheduled Target Credits} = \sum \text{scheduled\_work\_instances.credit\_value}$$

$$\text{Total Target Credits} = \frac{\text{Scheduled Target Credits}}{\text{work\_cycles.scheduled\_weight\_percentage} / 100}$$

$$\text{Raw Earned Credits} = \sum \text{credit\_ledger\_entries.amount}$$

$$\text{Display Progress Percentage} = \min\left(100, \frac{\text{Raw Earned Credits}}{\text{Total Target Credits}} \times 100\right)$$

$$\text{Salary Threshold Credits} = \text{Total Target Credits} \times \left(\frac{\text{work\_cycles.salary\_threshold\_percentage}}{100}\right)$$

$$\text{Salary Eligible} = \text{Raw Earned Credits} \ge \text{Salary Threshold Credits}$$

---

## 3. Smart Contract Verification Summary

- **Contract Model**: Minimal OpenZeppelin ERC-20 (`contracts/WorkLedgerToken.sol`)
- **Network**: Ethereum Sepolia (Chain ID: `11155111`)
- **ABI Surface**: `name()`, `symbol()`, `decimals()`, `totalSupply()`, `balanceOf(address)`, `transfer(address, uint256)`, `mint(address, uint256)`, `owner()`, `Transfer` event.
- **Treasury Model**: Server-side treasury wallet derived from `TREASURY_PRIVATE_KEY` pays testnet gas and executes `mint(facultyAuditAddress, amountWei)`. Faculty accounts require 0 ETH.
- **Idempotency**: Salary settlement transactions are linked to `salary_requests.id`, updating status to `ON_CHAIN_CONFIRMED` upon receiving 1 block confirmation.
