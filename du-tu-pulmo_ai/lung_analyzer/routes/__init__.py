"""Routes module for lung analyzer API."""
from .predict import predict_bp
from .rules import rules_bp

__all__ = ['predict_bp', 'rules_bp']
