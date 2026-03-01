# Test Cloud Studio Server

Backend server for executing Playwright tests.

## Setup

### Install Dependencies

```bash
cd server
npm install
```

### Install Playwright Browsers

```bash
npx playwright install
```

## Running the Server

### Production Mode

```bash
npm start
```

### Development Mode (with auto-reload)

```bash
npm run dev
```

The server will run on `http://localhost:3001`

## API Endpoints

### POST /run-test

Execute a Playwright test with user-provided code.

**Request Body:**
```json
{
  "code": "await page.goto('https://example.com');"
}
```

**Response:**
```json
{
  "success": true,
  "logs": "Test output logs..."
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok"
}
```

## How It Works

1. Receives user code via POST request
2. Creates temporary directory with unique timestamp
3. Generates `test.spec.ts` file wrapping user code in Playwright test structure
4. Executes `npx playwright test` in the temp directory
5. Captures stdout, stderr, and exit code
6. Returns results with success status and logs
7. Cleans up temporary files

## Notes

- Each test runs in isolation with its own temp directory
- Temp directories are automatically cleaned up after execution
- 30-second timeout per test execution
- No database required - fully stateless
