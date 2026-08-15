from sqlalchemy import Column, Integer, String, Text
from database import Base

class PortfolioSession(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    tickers = Column(Text) # JSON string of list of tickers
    constraints = Column(Text) # JSON string of constraints
    created_at = Column(String)
    updated_at = Column(String)
