from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/drive']

flow = InstalledAppFlow.from_client_secrets_file(
    'services/credentials/client_secret.json', SCOPES
)
creds = flow.run_local_server(port=0)

service = build('drive', 'v3', credentials=creds)

FOLDER_ID = "0AEzywvrOxRQzUk9PVA"
SERVICE_ACCOUNT_EMAIL = "cognify-drive@cognify-drive.iam.gserviceaccount.com"

permission = {
    'type': 'user',
    'role': 'organizer',
    'emailAddress': SERVICE_ACCOUNT_EMAIL
}

service.permissions().create(
    fileId=FOLDER_ID,
    body=permission,
    supportsAllDrives=True,
    sendNotificationEmail=False
).execute()

print("✅ Permission granted!")