"""The fixed catalog of grantable capabilities behind the admin-editable
Roles & Permissions matrix. `administrator` is always a superuser and is
never represented here or in the `role_permissions` table — only
`mine_manager` and `field_worker` rows are ever stored/edited, which is what
keeps "who can edit permissions" from being a lockout risk: no edit here can
ever remove an administrator's own access.

Adding a new capability: add it here, add a matching seed row (both roles,
both `False` unless you deliberately want a different default) in a new
Alembic migration, and guard the relevant endpoint with
`require_permission("your.capability")`.
"""

CAPABILITIES: list[tuple[str, str]] = [
    ("blueprint.write", "Upload / edit / delete blueprint & sections"),
    ("users.view", "View users (Workforce)"),
    ("users.manage", "Create users / change roles / activate-deactivate"),
    ("inspections.schedule", "Schedule inspections"),
    ("incidents.transition", "Transition incidents (assign/resolve/escalate)"),
    ("incidents.sign_off", "Sign off incidents"),
    ("governance.view", "View alert rules / compliance rules"),
    ("governance.edit", "Edit alert rules / compliance rules"),
    ("audit_logs.view", "View audit logs"),
    ("system_health.view", "View system health"),
]

CAPABILITY_KEYS = {key for key, _ in CAPABILITIES}
