"""
Timezone utilities for handling dates in America/Lima timezone.
All dates in the application should use these helpers for consistency.
"""
from datetime import datetime
from typing import Optional
import pytz

from config import settings


# Load timezone from settings
TIMEZONE = pytz.timezone(settings.TIMEZONE)


def now_lima() -> datetime:
    """
    Get current datetime in Lima timezone.
    
    Returns:
        datetime: Current time in America/Lima timezone
    
    Example:
        >>> from utils.timezone import now_lima
        >>> current_time = now_lima()
        >>> print(current_time.tzinfo)  # America/Lima
    """
    return datetime.now(TIMEZONE)


def to_lima(dt: Optional[datetime]) -> Optional[datetime]:
    """
    Convert a datetime to Lima timezone.
    
    Args:
        dt: datetime to convert (can be naive or aware)
    
    Returns:
        datetime in Lima timezone, or None if input is None
    
    Example:
        >>> from datetime import datetime
        >>> utc_time = datetime.utcnow()
        >>> lima_time = to_lima(utc_time)
    """
    if dt is None:
        return None
    
    if dt.tzinfo is None:
        # Assume naive datetime is UTC
        dt = pytz.utc.localize(dt)
    
    return dt.astimezone(TIMEZONE)


def to_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """
    Convert a datetime to UTC timezone.
    
    Args:
        dt: datetime to convert (can be naive or aware)
    
    Returns:
        datetime in UTC timezone, or None if input is None
    """
    if dt is None:
        return None
    
    if dt.tzinfo is None:
        # Assume naive datetime is Lima
        dt = TIMEZONE.localize(dt)
    
    return dt.astimezone(pytz.utc)


def format_date_lima(dt: Optional[datetime], format_str: str = "%d/%m/%Y %H:%M") -> str:
    """
    Format a datetime to string in Lima timezone.
    
    Args:
        dt: datetime to format
        format_str: strftime format string
    
    Returns:
        Formatted date string, or empty string if input is None
    """
    if dt is None:
        return ""
    
    lima_dt = to_lima(dt)
    return lima_dt.strftime(format_str)
