"""One-off bootstrap: promote an already-registered user to administrator.

The public POST /api/auth/register endpoint deliberately rejects
role="administrator" (see schemas/auth.py's SelfRegisterableRole) — there is
no public way to create the first admin account. This script is that
escape hatch: register a normal account through the app first (as
mine_manager or field_worker, doesn't matter which), then run this script
against that account's email to promote it. After that, the new
administrator can create further admins via POST /api/users.

Usage (from backend/):
    python -m scripts.promote_to_admin someone@example.com
"""
import asyncio
import sys

from sqlalchemy import select

from app.db.database import AsyncSessionLocal
from app.models.enums import UserRole
from app.models.user import User


async def promote(email: str) -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user is None:
            print(f"No user found with email {email!r}. Register the account first, then re-run this script.")
            return
        if user.role == UserRole.administrator:
            print(f"{email} is already an administrator.")
            return
        previous_role = user.role.value
        user.role = UserRole.administrator
        await db.commit()
        print(f"Promoted {email} from {previous_role} to administrator.")


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python -m scripts.promote_to_admin <email>")
        sys.exit(1)
    asyncio.run(promote(sys.argv[1]))


if __name__ == "__main__":
    main()
