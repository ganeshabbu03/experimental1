from pydantic import BaseModel

class ProfileResponse(BaseModel):
    id: str
    email: str
    name: str
