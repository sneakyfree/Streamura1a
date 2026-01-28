# Streamura SOC 2 Type II Control Matrix

**Document Version:** 1.0  
**Last Updated:** January 28, 2026  
**Compliance Framework:** AICPA SOC 2 Trust Service Criteria  
**Audit Period:** 12 months

---

## Executive Summary

This document outlines Streamura's SOC 2 Type II controls across Security, Availability, Processing Integrity, Confidentiality, and Privacy (TSC). Each control is mapped to specific code implementations for auditor verification.

---

## Table of Contents

1. [Security Controls (CC)](#security-controls-cc)
2. [Availability Controls (A)](#availability-controls-a)
3. [Processing Integrity Controls (PI)](#processing-integrity-controls-pi)
4. [Confidentiality Controls (C)](#confidentiality-controls-c)
5. [Privacy Controls (P)](#privacy-controls-p)
6. [Evidence Collection](#evidence-collection)

---

## Security Controls (CC)

### CC1.0 - Control Environment

| Control ID | Description | Implementation | Evidence |
|------------|-------------|----------------|----------|
| CC1.1 | Security policies documented | `/docs/security-policy.md` | Policy document |
| CC1.2 | Security awareness training | Onboarding process | Training records |
| CC1.3 | Code review requirements | GitHub PR requirements | PR review logs |

### CC2.0 - Communication and Information

| Control ID | Description | Implementation | Evidence |
|------------|-------------|----------------|----------|
| CC2.1 | Security incident reporting | `backend/emergency.py` | Incident tickets |
| CC2.2 | System change notifications | Deployment pipeline | Change logs |

### CC3.0 - Risk Assessment

| Control ID | Description | Implementation | Evidence |
|------------|-------------|----------------|----------|
| CC3.1 | Risk assessment process | Quarterly reviews | Risk register |
| CC3.2 | Vulnerability management | `backend/security_scanner.py` | Scan reports |

### CC4.0 - Monitoring Activities

| Control ID | Description | Implementation | Evidence |
|------------|-------------|----------------|----------|
| CC4.1 | Security monitoring | `backend/metrics.py` | Prometheus dashboards |
| CC4.2 | Log aggregation | ELK Stack / CloudWatch | Log exports |
| CC4.3 | Alerting | `backend/health.py` | Alert history |

### CC5.0 - Control Activities

| Control ID | Description | Implementation | Evidence |
|------------|-------------|----------------|----------|
| CC5.1 | Access control policies | `backend/auth.py` | Access logs |
| CC5.2 | Segregation of duties | Role-based access | User role matrix |

### CC6.0 - Logical and Physical Access Controls

| Control ID | Description | Implementation | Evidence |
|------------|-------------|----------------|----------|
| CC6.1 | User authentication | `backend/auth.py:authenticate_user()` | Auth logs |
| CC6.2 | Multi-factor authentication | `backend/two_factor.py` | 2FA enrollment |
| CC6.3 | Password requirements | `backend/auth.py:password_policy` | Policy config |
| CC6.4 | Session management | JWT with expiration | Token config |
| CC6.5 | Access provisioning | Admin role assignment | Audit trail |
| CC6.6 | Access revocation | Account deactivation | Termination logs |
| CC6.7 | Infrastructure access | SSH key management | Access logs |
| CC6.8 | Data encryption at rest | Database encryption | AWS RDS config |
| CC6.9 | Data encryption in transit | TLS 1.3 | Certificate config |

### CC7.0 - System Operations

| Control ID | Description | Implementation | Evidence |
|------------|-------------|----------------|----------|
| CC7.1 | Configuration management | Infrastructure as Code | Terraform state |
| CC7.2 | Change management | PR review process | GitHub history |
| CC7.3 | Vulnerability scanning | Dependabot / Snyk | Scan reports |
| CC7.4 | Incident response | `backend/emergency.py` | Incident records |
| CC7.5 | Business continuity | Multi-AZ deployment | DR test results |

### CC8.0 - Change Management

| Control ID | Description | Implementation | Evidence |
|------------|-------------|----------------|----------|
| CC8.1 | Change authorization | PR approval workflow | Approval logs |
| CC8.2 | Testing requirements | CI/CD test suite | Test results |
| CC8.3 | Deployment automation | GitHub Actions | Deployment logs |

### CC9.0 - Risk Mitigation

| Control ID | Description | Implementation | Evidence |
|------------|-------------|----------------|----------|
| CC9.1 | Vendor risk assessment | Third-party reviews | Assessment docs |
| CC9.2 | Data processing agreements | DPA with vendors | Contract copies |

---

## Availability Controls (A)

| Control ID | Description | Implementation | Evidence |
|------------|-------------|----------------|----------|
| A1.1 | Uptime SLA | 99.9% target | Monitoring data |
| A1.2 | Capacity planning | Auto-scaling | AWS metrics |
| A1.3 | Disaster recovery | Multi-region backup | DR test logs |
| A1.4 | Health monitoring | `backend/health.py` | Health checks |
| A1.5 | Incident management | PagerDuty integration | Incident timeline |

### Health Check Endpoints

```python
# backend/health.py
@router.get("/health")      # Liveness probe
@router.get("/ready")       # Readiness probe  
@router.get("/status")      # Detailed status
```

---

## Processing Integrity Controls (PI)

| Control ID | Description | Implementation | Evidence |
|------------|-------------|----------------|----------|
| PI1.1 | Input validation | Pydantic models | Schema definitions |
| PI1.2 | Agent decision logging | `backend/agentic.py:ActionLogger` | Decision audit |
| PI1.3 | HITL approval gates | `backend/hitl.py` | Approval records |
| PI1.4 | Transaction integrity | Database transactions | Transaction logs |
| PI1.5 | Data completeness | Validation middleware | Error logs |

### Agent Decision Audit Trail

```python
# backend/agentic.py
class AgentDecision:
    id: int
    agent_name: str
    action_type: str
    input_snapshot: JSON         # Immutable input
    output_snapshot: JSON        # Immutable output
    reasoning: str
    confidence: float
    requires_approval: bool
    approved_by: Optional[int]
    approval_notes: Optional[str]
    created_at: datetime
```

### Human-in-the-Loop Controls

| Threshold | Action Required | Approver Level |
|-----------|-----------------|----------------|
| Payouts > $10,000 | HITL Approval | Finance Admin |
| Account bans | HITL Approval | Trust & Safety |
| Content removal | HITL Approval | Moderation Team |
| Emergency actions | Auto-approve + Audit | System + Review |

---

## Confidentiality Controls (C)

| Control ID | Description | Implementation | Evidence |
|------------|-------------|----------------|----------|
| C1.1 | Data classification | Privacy labels | Schema docs |
| C1.2 | Access restrictions | RBAC | Permission matrix |
| C1.3 | Data masking | `backend/data_export.py` | Masked exports |
| C1.4 | Encryption | AES-256 at rest | AWS KMS config |
| C1.5 | Secure disposal | Data deletion scripts | Deletion logs |

### Data Classification

| Level | Description | Examples |
|-------|-------------|----------|
| Public | Publicly accessible | Stream titles, usernames |
| Internal | Platform users only | Chat messages, follower lists |
| Confidential | Authorized personnel | Payment info, KYC data |
| Restricted | Need-to-know only | SSN, government IDs |

---

## Privacy Controls (P)

| Control ID | Description | Implementation | Evidence |
|------------|-------------|----------------|----------|
| P1.1 | Privacy notice | Terms page | Published notice |
| P2.1 | Consent collection | Registration flow | Consent records |
| P3.1 | Data collection purpose | Privacy policy | Policy document |
| P4.1 | Data use limitation | Access controls | Audit logs |
| P5.1 | Access request handling | `backend/data_export.py` | Export logs |
| P6.1 | Disclosure controls | Third-party DPAs | Agreements |
| P7.1 | Data quality | Validation rules | Error logs |
| P8.1 | Complaint handling | Support tickets | Ticket history |

### GDPR/CCPA Implementation

| Right | Implementation | SLA |
|-------|----------------|-----|
| Right to Access | `backend/data_export.py` | 30 days |
| Right to Delete | `backend/data_export.py:delete_user_data()` | 45 days |
| Right to Portability | JSON export | 30 days |
| Right to Opt-Out | `backend/ccpa.py` | 15 days |

---

## Evidence Collection

### Automated Evidence Collection

| Evidence Type | Collection Method | Retention |
|---------------|-------------------|-----------|
| Access logs | CloudWatch + Prometheus | 1 year |
| Change logs | GitHub API | Indefinite |
| Approval records | Database + HITL Queue | 7 years |
| Security scans | Snyk / Dependabot | 1 year |
| Incident records | PagerDuty + Emergency logs | 3 years |

### Auditor Access

1. **Log Access**: Read-only access to CloudWatch/Prometheus
2. **Code Review**: GitHub repository access
3. **Database Queries**: Redacted query access via admin UI
4. **Configuration**: Infrastructure configuration via Terraform

### Key Implementation Files

| Category | File | Purpose |
|----------|------|---------|
| Authentication | `backend/auth.py` | User authentication, JWT |
| Authorization | `backend/auth.py` | Role-based access control |
| 2FA | `backend/two_factor.py` | Multi-factor authentication |
| Audit Trail | `backend/agentic.py` | Agent decision logging |
| HITL | `backend/hitl.py` | Human approval gates |
| Data Export | `backend/data_export.py` | GDPR data portability |
| CCPA | `backend/ccpa.py` | California privacy rights |
| Monitoring | `backend/metrics.py` | Prometheus metrics |
| Health | `backend/health.py` | System health checks |
| Tracing | `backend/tracing.py` | Distributed tracing |
| Rate Limiting | `backend/rate_limiting.py` | Abuse prevention |
| Emergency | `backend/emergency.py` | Incident response |

---

## Control Testing Schedule

| Control Category | Testing Frequency | Last Test | Next Test |
|------------------|-------------------|-----------|-----------|
| Access Controls | Quarterly | Q4 2025 | Q1 2026 |
| Change Management | Monthly | Jan 2026 | Feb 2026 |
| Vulnerability Scans | Weekly | Week 4 | Week 5 |
| DR Testing | Semi-annually | Q3 2025 | Q1 2026 |
| Penetration Testing | Annually | Nov 2025 | Nov 2026 |

---

## Appendix: Control Implementation Verification

### A. Authentication Controls Test

```bash
# Verify password policy enforcement
curl -X POST /api/v1/auth/register \
  -d '{"email":"test@example.com","password":"weak"}' 
# Expected: 400 - Password does not meet requirements

# Verify 2FA enforcement for admin
curl -X POST /api/v1/auth/login \
  -d '{"email":"admin@streamura.com","password":"..."}' 
# Expected: 200 with 2fa_required: true
```

### B. HITL Approval Test

```bash
# Submit large payout (requires approval)
curl -X POST /api/v1/payouts/request \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"amount": 15000}' 
# Expected: 200 with status: "pending_approval"

# Verify approval required
curl -X GET /api/v1/admin/hitl/queue \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# Expected: Contains payout approval request
```

### C. Data Export Test

```bash
# Request GDPR export
curl -X POST /api/v1/privacy/export \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 with export_id and status: "processing"

# Verify export contains required data
# Check: profile, streams, transactions, messages, preferences
```

---

**Document Control**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-28 | Streamura Security | Initial SOC 2 control matrix |

**Approved By:** Security Team Lead  
**Review Date:** 2026-07-28
