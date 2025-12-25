"""
GrePre Smart Life - Security Utilities
Account lockout, password validation, and security helpers
"""

import asyncio
import logging
import re
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple

logger = logging.getLogger("grepre.security")


# ============================================================================
# PASSWORD VALIDATION
# ============================================================================
class PasswordValidator:
    """
    Validates password strength according to security best practices.
    """

    MIN_LENGTH = 8
    MAX_LENGTH = 128

    # Password requirements
    REQUIRE_UPPERCASE = True
    REQUIRE_LOWERCASE = True
    REQUIRE_DIGIT = True
    REQUIRE_SPECIAL = True

    # Common weak passwords to reject
    COMMON_PASSWORDS = {
        "password",
        "12345678",
        "123456789",
        "qwerty123",
        "password1",
        "password123",
        "admin123",
        "letmein",
        "welcome1",
        "monkey123",
        "dragon123",
        "master123",
        "login123",
        "abc12345",
        "trustno1",
    }

    @classmethod
    def validate(cls, password: str) -> Tuple[bool, list[str]]:
        """
        Validate password strength.
        Returns (is_valid, list_of_errors)
        """
        errors = []

        # Length check
        if len(password) < cls.MIN_LENGTH:
            errors.append(f"Password must be at least {cls.MIN_LENGTH} characters long")

        if len(password) > cls.MAX_LENGTH:
            errors.append(f"Password must be less than {cls.MAX_LENGTH} characters")

        # Character requirements
        if cls.REQUIRE_UPPERCASE and not re.search(r"[A-Z]", password):
            errors.append("Password must contain at least one uppercase letter")

        if cls.REQUIRE_LOWERCASE and not re.search(r"[a-z]", password):
            errors.append("Password must contain at least one lowercase letter")

        if cls.REQUIRE_DIGIT and not re.search(r"\d", password):
            errors.append("Password must contain at least one number")

        if cls.REQUIRE_SPECIAL and not re.search(
            r"[!@#$%^&*(),.?\":{}|<>_\-+=\[\]\\;'/`~]", password
        ):
            errors.append(
                "Password must contain at least one special character (!@#$%^&*...)"
            )

        # Common password check
        if password.lower() in cls.COMMON_PASSWORDS:
            errors.append(
                "This password is too common. Please choose a stronger password"
            )

        # Sequential/repeated character check
        if cls._has_sequential_chars(password):
            errors.append("Password contains too many sequential characters")

        if cls._has_repeated_chars(password):
            errors.append("Password contains too many repeated characters")

        return len(errors) == 0, errors

    @classmethod
    def _has_sequential_chars(cls, password: str, max_seq: int = 4) -> bool:
        """Check for sequential characters like '1234' or 'abcd'"""
        for i in range(len(password) - max_seq + 1):
            chunk = password[i : i + max_seq]
            if chunk.isdigit():
                nums = [int(c) for c in chunk]
                if all(nums[j + 1] - nums[j] == 1 for j in range(len(nums) - 1)):
                    return True
            elif chunk.isalpha():
                ords = [ord(c.lower()) for c in chunk]
                if all(ords[j + 1] - ords[j] == 1 for j in range(len(ords) - 1)):
                    return True
        return False

    @classmethod
    def _has_repeated_chars(cls, password: str, max_repeat: int = 3) -> bool:
        """Check for repeated characters like 'aaa' or '111'"""
        for i in range(len(password) - max_repeat + 1):
            chunk = password[i : i + max_repeat]
            if len(set(chunk)) == 1:
                return True
        return False

    @classmethod
    def get_strength_score(cls, password: str) -> dict:
        """
        Get a password strength score (0-100) with breakdown.
        """
        score = 0
        breakdown = {}

        # Length score (up to 30 points)
        length_score = min(30, len(password) * 2)
        score += length_score
        breakdown["length"] = length_score

        # Character variety (up to 40 points)
        variety_score = 0
        if re.search(r"[a-z]", password):
            variety_score += 10
        if re.search(r"[A-Z]", password):
            variety_score += 10
        if re.search(r"\d", password):
            variety_score += 10
        if re.search(r"[!@#$%^&*(),.?\":{}|<>_\-+=\[\]\\;'/`~]", password):
            variety_score += 10
        score += variety_score
        breakdown["variety"] = variety_score

        # Uniqueness (up to 20 points)
        unique_ratio = len(set(password)) / len(password) if password else 0
        uniqueness_score = int(unique_ratio * 20)
        score += uniqueness_score
        breakdown["uniqueness"] = uniqueness_score

        # Bonus for length (up to 10 points)
        if len(password) >= 12:
            bonus = min(10, (len(password) - 12) + 5)
            score += bonus
            breakdown["bonus"] = bonus

        # Determine strength level
        if score >= 80:
            level = "strong"
        elif score >= 60:
            level = "good"
        elif score >= 40:
            level = "fair"
        else:
            level = "weak"

        return {"score": min(100, score), "level": level, "breakdown": breakdown}


# ============================================================================
# ACCOUNT LOCKOUT
# ============================================================================
class AccountLockoutManager:
    """
    Manages account lockout after failed login attempts.
    In-memory implementation - use Redis for multi-instance deployments.
    """

    def __init__(
        self,
        max_attempts: int = 5,
        lockout_duration_minutes: int = 15,
        reset_after_minutes: int = 60,
    ):
        self.max_attempts = max_attempts
        self.lockout_duration = timedelta(minutes=lockout_duration_minutes)
        self.reset_after = timedelta(minutes=reset_after_minutes)

        # Track failed attempts: {email: [(timestamp, ip), ...]}
        self.failed_attempts: Dict[str, list] = defaultdict(list)

        # Track lockouts: {email: lockout_until}
        self.lockouts: Dict[str, datetime] = {}

        self._lock = asyncio.Lock()

    async def record_failed_attempt(
        self, email: str, ip_address: str
    ) -> Tuple[bool, Optional[int]]:
        """
        Record a failed login attempt.
        Returns (is_now_locked, lockout_seconds_remaining)
        """
        async with self._lock:
            now = datetime.utcnow()

            # Clean old attempts
            cutoff = now - self.reset_after
            self.failed_attempts[email] = [
                (ts, ip) for ts, ip in self.failed_attempts[email] if ts > cutoff
            ]

            # Record new attempt
            self.failed_attempts[email].append((now, ip_address))

            # Check if should lock
            if len(self.failed_attempts[email]) >= self.max_attempts:
                lockout_until = now + self.lockout_duration
                self.lockouts[email] = lockout_until

                logger.warning(
                    f"Account locked: {email} after {len(self.failed_attempts[email])} "
                    f"failed attempts from IPs: {[ip for _, ip in self.failed_attempts[email][-5:]]}"
                )

                return True, int(self.lockout_duration.total_seconds())

            return False, None

    async def is_locked(self, email: str) -> Tuple[bool, Optional[int]]:
        """
        Check if an account is currently locked.
        Returns (is_locked, seconds_remaining)
        """
        async with self._lock:
            if email not in self.lockouts:
                return False, None

            now = datetime.utcnow()
            lockout_until = self.lockouts[email]

            if now >= lockout_until:
                # Lockout expired
                del self.lockouts[email]
                return False, None

            seconds_remaining = int((lockout_until - now).total_seconds())
            return True, seconds_remaining

    async def clear_failed_attempts(self, email: str):
        """Clear failed attempts after successful login"""
        async with self._lock:
            if email in self.failed_attempts:
                del self.failed_attempts[email]
            if email in self.lockouts:
                del self.lockouts[email]

    async def get_attempt_count(self, email: str) -> int:
        """Get current failed attempt count"""
        async with self._lock:
            now = datetime.utcnow()
            cutoff = now - self.reset_after

            valid_attempts = [
                (ts, ip)
                for ts, ip in self.failed_attempts.get(email, [])
                if ts > cutoff
            ]
            return len(valid_attempts)


# Global instance
lockout_manager = AccountLockoutManager()


# ============================================================================
# INPUT SANITIZATION
# ============================================================================
def sanitize_input(text: str, max_length: int = 1000) -> str:
    """
    Sanitize user input to prevent XSS and injection attacks.
    """
    if not text:
        return ""

    # Truncate to max length
    text = text[:max_length]

    # Remove null bytes
    text = text.replace("\x00", "")

    # Basic HTML escape (for display purposes)
    # Note: Use proper templating engine escaping for HTML output
    replacements = {
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#x27;",
    }
    for char, escape in replacements.items():
        text = text.replace(char, escape)

    return text.strip()


def is_safe_filename(filename: str) -> bool:
    """
    Check if a filename is safe (no path traversal, safe characters).
    """
    if not filename:
        return False

    # No path separators
    if "/" in filename or "\\" in filename:
        return False

    # No null bytes
    if "\x00" in filename:
        return False

    # No special directory references
    if filename in (".", "..", ""):
        return False

    # Only allow safe characters
    safe_pattern = re.compile(r"^[\w\-. ]+$")
    return bool(safe_pattern.match(filename))
