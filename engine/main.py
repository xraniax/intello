from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from routers import process

app = FastAPI()

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = {}
    for error in exc.errors():
        field = ".".join([str(x) for x in error["loc"] if x != "body"])
        errors[field] = error["msg"]
        
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"status": "error", "code": "VALIDATION_ERROR", "message": "Engine validation failed", "errors": errors},
    )

@app.get("/health")
def health_check():
    return {"status": "ok"}

app.include_router(process.router)
