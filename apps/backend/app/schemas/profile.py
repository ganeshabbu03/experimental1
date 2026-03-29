from pydantic import BaseModel, field_validator

class ProfileResponse(BaseModel):
    id: str
    email: str
    name: str

    @field_validator('id', mode='before')
    @classmethod
    def validate_id(cls, v):
        if v is None:
            return None
        return str(v)
