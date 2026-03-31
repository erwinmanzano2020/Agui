# **HR Master Plan**

*(Living Document – Identity-Aware & Phase-Aligned)*

*\#\# 🔗 Development Operating Principles (Source of Truth)*

*This document is governed by the canonical rules defined in:*

*\*\*agui-development-operating-principles.md\*\**

*All architecture, identity, tenancy, access control, and sequencing decisions*

*must comply with those principles.*

*If a conflict exists, the Operating Principles override this plan.*

Companion to **Agui Roadmap** → HR track

**Goal:** Build an HR child app (inside each Workspace / House) that manages employees, time & attendance, and payroll —  
 **identity-aware by default**, simple for sari-sari stores, but structurally strong enough for growth.

 ---

 ## **🔵 1\. Positioning in the App Architecture**

 ### **House / Workspace Context**

 * **House** \= business tenant (canonical data boundary)  
 * **Workspace UI** \= the working interface of a House

 ### **Child Apps under a Workspace**

 * Overview  
 * **HR** ← *(this plan)*  
 * Operations (POS, Inventory, Shifts)  
 * Finance  
 * Settings / Admin

 ---

 ## **📑 HR Child App — Tabs**

 Initial tab set (MVP \+ near future):

 1. **Employees** *(default)*  
 2. **DTR / Time & Attendance**  
 3. **Payroll**  
 4. **Payslips**  
 5. **Shifts & Schedules** *(future)*  
 6. **Approvals & Requests** *(future)*  
 7. **HR Config** *(future)*

 ---

 ## **🔐 2\. Identity Principles (Canonical for HR)**

 **HR does NOT own identity.**  
  HR **consumes** the platform identity system.

  ### **Core Rules**

  * **Entity \= real human**  
    * One person → one entity  
      * Entity is role-agnostic  
      * **Employees are roles, not people**  
        * Employee \= house-scoped role attached to an entity  
        * **Lookup-first enrollment is mandatory**  
          * Normalize → Lookup → Select → Prefill → Create if none  
          * **Identifiers are weak by nature**  
            * Phone & email are **not globally unique**  
              * Multiple identifiers per entity are allowed  
              * **House-scoped uniqueness**  
                * A House may only have **one ACTIVE employee per entity**  
                  * Rehire \= deactivate → create new employee role  
                  * **Privacy by default**  
                    * Mask identifiers in UI  
                      * Role-scoped access only  
                      * **Emergency contacts ≠ identity**  
                        * Stored separately  
                          * Never used for lookup or dedupe

                          These rules are **non-negotiable** and apply to all HR phases.

                          ---

                          ## **🟢 3\. Phases Overview (HR-0 → HR-5)**

                          * **HR-0 — Foundations & Access**  
                          * **HR-1 — Employees Core (Identity-Aware)**  
                          * **HR-2 — Time & Attendance (DTR)**  
                          * **HR-3 — Payroll & Payslips (MVP)**  
                          * **HR-4 — Shifts, Schedules & Approvals**  
                          * **HR-5 — Advanced HR & Analytics**

                          Each phase delivers usable value while preserving long-term correctness.

                          ---

                          ## **🔵 4\. HR-0 — Foundations & Access**

                          ### **Objectives**

                          * Lock navigation: Workspace → HR → Tabs  
                          * Enforce access rules early  
                          * Prepare identity-aware permissions

                          ### **Features**

                          * HR tile inside Workspace  
                          * HR child-app shell  
                          * Tab bar (Employees, DTR, Payroll, Payslips)

                          ### **Roles (Initial)**

                          * **Owner / Admin**  
                            * Full HR access  
                            * **HR / Payroll Manager**  
                              * Employees, DTR, payroll  
                              * **Supervisor / Manager** *(future)*  
                                * Approvals  
                                * **Employee**  
                                  * Self-service (later)

                                  ### **Tech / Infra**

                                  * House-scoped routing  
                                  * Supabase RLS enforced  
                                  * Security-definer RPCs for identity lookups  
                                  * PostgREST schema reload discipline

                                  ---

                                  ## **🔵 5\. HR-1 — Employees Core (Identity-Aware)**

                                  ### **Objectives**

                                  * Single source of truth for employees  
                                  * Zero duplicate active employees per house  
                                  * Reduce encoder work via lookup-first flows

                                  ---

                                  ### **5.1 Employees Tab — UX**

                                  * Default HR entry  
                                  * Header: **Employees** \+ `Add Employee`  
                                  * Filters:  
                                    * Status (Active / Inactive)  
                                      * Branch  
                                      * Search:  
                                        * Name  
                                          * Identifier (masked)

                                          Row click → **Employee Profile**

                                          ---

                                          ### **5.2 Add Employee Flow (Lookup-First)**

                                          **Step 1: Identity Lookup**

                                          * Enter phone / email / future identifiers  
                                          * System performs masked lookup  
                                          * Results show match confidence:  
                                            * None  
                                              * Single  
                                                * Multiple

                                                **Step 2: Selection**

                                                * If match selected → prefill name & identity  
                                                * If no match → proceed with manual entry

                                                **Step 3: Create Employee**

                                                * Enforce:  
                                                  * HR access  
                                                    * House scope  
                                                      * Branch validation  
                                                        * **Block duplicate ACTIVE employee per entity**

                                                        ---

                                                        ### **5.3 Employee Profile**

                                                        Sections:

                                                        * **Summary**  
                                                          * Full name  
                                                            * Employee code (label only)  
                                                              * Status  
                                                                * Branch  
                                                                * **Identity (Masked)**  
                                                                  * Display name  
                                                                    * Linked identifiers (email / phone)  
                                                                    * **Employment**  
                                                                      * Hire date  
                                                                        * Employment type  
                                                                        * **Links**  
                                                                          * DTR  
                                                                            * Payroll  
                                                                              * Payslips

                                                                              ---

                                                                              ### **5.4 Data Model (HR-1 Canonical)**

                                                                              **employees**

                                                                              * id  
                                                                              * house\_id  
                                                                              * entity\_id *(nullable, but preferred)*  
                                                                              * full\_name  
                                                                              * code *(house-scoped label, DB-generated)*  
                                                                              * status (active / inactive)  
                                                                              * employment\_type  
                                                                              * branch\_id *(nullable)*  
                                                                              * created\_at

                                                                              Names live in **employees**  
                                                                               Identity lives in **entities**

                                                                               ---

                                                                               ### **Scope Boundaries**

                                                                               * No identity editing  
                                                                               * No payroll logic  
                                                                               * No government reports yet

                                                                               ---

                                                                               ## **🔵 6\. HR-2 — Time & Attendance (DTR)**

                                                                               ### **Objectives**

                                                                               * Clean attendance data  
                                                                               * Payroll-ready without complexity

                                                                               ### **Views**

                                                                               #### **DTR Today**

                                                                               * Ops view  
                                                                               * Branch-filtered  
                                                                               * Live status

                                                                               #### **DTR Bulk Entry**

                                                                               * HR view  
                                                                               * Grid encoding  
                                                                               * CSV import

                                                                               ### **Data**

                                                                               **dtr\_segments**

                                                                               * employee\_id  
                                                                               * date  
                                                                               * hours\_worked  
                                                                               * overtime  
                                                                               * status  
                                                                               * source

                                                                               DTR is **canonical**; POS feeds later.

                                                                               ---

                                                                               ## **🔵 7\. HR-3 — Payroll & Payslips (MVP)**

                                                                               ### **Objectives**

                                                                               * Correct, understandable payroll  
                                                                               * SME-friendly

                                                                               ### **Payroll Runs**

                                                                               * Period  
                                                                               * Draft / Finalized  
                                                                               * Employee breakdown  
                                                                               * Manual adjustments

                                                                               ### **Payslips**

                                                                               * Snapshot-based  
                                                                               * Downloadable  
                                                                               * Employee self-view (later)

                                                                               ---

                                                                               ## **🔵 8\. HR-4 — Shifts, Schedules & Approvals**

                                                                               * Shift templates  
                                                                               * Scheduling  
                                                                               * OT / Leave / DTR correction approvals  
                                                                               * Audit trails

                                                                               ---

                                                                               ## **🟣 9\. HR-5 — Advanced HR & Analytics**

                                                                               * Policy engines  
                                                                               * Dashboards  
                                                                               * Government exports  
                                                                               * Finance integrations

                                                                               ---

                                                                               ## **🔗 10\. Dependencies & Cross-Links**

                                                                               * **Agui Roadmap** — platform context  
                                                                               * **POS Master Plan** — attendance & customer identity  
                                                                               * **Identity Principles** — canonical rules

                                                                               ---

                                                                               ## **🚀 11\. Immediate Next Steps**

                                                                               1. Finalize HR-1 UX (Employees \+ Lookup)  
                                                                               2. Stabilize HR-2 DTR  
                                                                               3. Prepare HR-3 payroll MVP  
                                                                               4. Freeze HR patterns before POS resumes

                                                                               ---

                                                                               ## **🔐 Tenancy & Workspace Clarification (Canonical)**

                                                                               * HR always operates **within a House**  
                                                                               * Employees belong to a House  
                                                                               * Branches are **locations**, not tenants  
                                                                               * One House → many Branches  
                                                                               * One ACTIVE employee per entity per House

                                                                               ---

                                                                               ### **📌 Final Note**

                                                                               HR is the **first real consumer** of Agui’s identity system.  
                                                                                Discipline here prevents data debt, fraud, and UX pain across POS, Loyalty, and beyond.