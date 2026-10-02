# When to Mock

Mock at **system boundaries** only:

- External APIs: ESP connectors, AI providers, S3/storage, mail sending
- The database: there is no test database here, so mock the Mongoose model at the model boundary, not the service that uses it
- Time and randomness (`jest.useFakeTimers()`, a fixed date)
- The logger (`packages/server/utils/logger.js`), to keep the output quiet
- The auth guard, when the test is about the route and not about authentication (see `tests/server/ai-skill/routes/`)

Don't mock:

- Your own services, helpers and utils
- Internal collaborators
- Anything you control

## Designing for Mockability

At system boundaries, design interfaces that are easy to mock:

**1. Pass dependencies in**

```javascript
// Easy to mock
function exportMailing(mailing, espClient) {
  return espClient.createCampaign(mailing.html);
}

// Hard to mock
function exportMailing(mailing) {
  const client = new BrevoClient(config.brevo.apiKey);
  return client.createCampaign(mailing.html);
}
```

**2. Prefer SDK-style interfaces over generic fetchers**

Create one function per external operation instead of one generic function with conditional logic:

```javascript
// GOOD: Each function is independently mockable
const espApi = {
  getLists: (profile) => http.get(`${profile.url}/lists`),
  createCampaign: (profile, payload) =>
    http.post(`${profile.url}/campaigns`, payload),
};

// BAD: Mocking requires conditional logic inside the mock
const espApi = {
  call: (endpoint, options) => http.request(endpoint, options),
};
```

The SDK approach means:

- Each mock returns one specific shape
- No conditional logic in test setup
- Easier to see which endpoints a test exercises
