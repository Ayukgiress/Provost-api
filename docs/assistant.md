# Assistant API Contract

The Provost assistant API provides AI-powered help for finding scholarships, fellowships, and grants, with tool usage tracking, user data isolation, and secure action confirmation.

## Endpoints

### GET /assistant/usage
Get current assistant message quota and limits for the authenticated user. Limits reset daily at UTC midnight. Free plan users get a lower message limit than Plus plan users. Provider failures (tool errors, API errors) do not count towards the daily limit.

**Response:**
```json
{
  "remaining": 5,
  "limit": 10,
  "resetsAt": "2026-10-17T00:00:00.000Z"
}
```

### POST /assistant/chat
Stream an AI assistant response using Server-Sent Events (SSE). The connection is automatically cleaned up when the client disconnects or after a 2-minute timeout. A maximum of 5 tool calls are allowed per chat session to prevent abuse.

**Request Body:**
```json
{
  "message": "Find me scholarships for computer science students",
  "conversationId": "optional-uuid-for-existing-conversation"
}
```

**SSE Events:**
- `token`: Individual text tokens from the AI response
- `cards`: Array of opportunity cards to display in the UI
- `done`: Chat completed, includes updated usage stats and conversation ID
- `error`: An error occurred, message not counted towards daily limit

### POST /assistant/confirm
Approve or reject a pending assistant action (currently only `save_opportunity` is supported). To save an opportunity, the user must have an existing pending action owned by their user ID that is not expired. Expired actions are automatically rejected.

**Request Body:**
```json
{
  "conversationId": "uuid-of-conversation",
  "actionId": "uuid-of-pending-action",
  "approve": true
}
```

## Tools
The assistant can only call approved tools. Unknown tools or invalid arguments are rejected before they reach the AI model. All tools only access the authenticated user's data.

Available tools:
- `search_opportunities`: Search published, unexpired opportunities
- `get_opportunity`: Get a published opportunity by ID (unpublished or unknown IDs are never returned)
- `get_my_matches`: Get personalized matches for the signed-in user only
- `explain_match`: Get match reasoning for an opportunity
- `get_profile_gaps`: Get missing profile fields for better matching
- `save_opportunity`: Create a pending save request that requires user confirmation

## Security & Hardening
- **Data isolation**: Users can never access or modify another user's data; all repository queries enforce `userId` filters
- **Prompt injection resistance**: Tool results are sanitized to prevent instruction injection from listing data; the system prompt explicitly tells the model to ignore instructions inside tool results
- **Rate limiting**: Global throttling is applied to all API endpoints to prevent abuse
- **Expired actions**: Pending actions expire after 15 minutes and cannot be approved
- **Usage tracking**: Only successful chats count towards the daily limit; errors and tool failures are not counted