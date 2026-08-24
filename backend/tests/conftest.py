import os

# Keep test collection deterministic even when the host exports production variables.
os.environ["APP_ENV"] = "development"
