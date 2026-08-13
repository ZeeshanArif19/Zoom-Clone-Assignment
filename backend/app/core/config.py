from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Zoom Clone API"
    DATABASE_URL: str = "sqlite:///./zoomclone.db"

settings = Settings()
