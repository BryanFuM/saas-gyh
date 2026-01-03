"""
Structured logging configuration.
Provides consistent logging across the application.
"""
import logging
import sys
from typing import Optional

from config import settings


def setup_logging(name: Optional[str] = None) -> logging.Logger:
    """
    Configure and return a logger instance.
    
    Args:
        name: Logger name (defaults to root logger)
    
    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name or "gyh_api")
    
    # Avoid adding handlers multiple times
    if logger.handlers:
        return logger
    
    # Set level based on environment
    level = logging.DEBUG if settings.DEBUG else logging.INFO
    logger.setLevel(level)
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    
    # Format based on environment
    if settings.DEBUG:
        # Detailed format for development
        formatter = logging.Formatter(
            "%(asctime)s | %(levelname)-8s | %(name)s:%(lineno)d | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
    else:
        # JSON-like format for production
        formatter = logging.Formatter(
            '{"time": "%(asctime)s", "level": "%(levelname)s", "logger": "%(name)s", "message": "%(message)s"}',
            datefmt="%Y-%m-%dT%H:%M:%S"
        )
    
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    return logger


# Default logger instance
logger = setup_logging()


def get_logger(name: str) -> logging.Logger:
    """
    Get a child logger with the specified name.
    
    Args:
        name: Logger name (will be prefixed with 'gyh_api.')
    
    Returns:
        Logger instance
    
    Example:
        >>> from utils.logging import get_logger
        >>> logger = get_logger("ingresos")
        >>> logger.info("Creating new ingreso lote")
    """
    return setup_logging(f"gyh_api.{name}")
