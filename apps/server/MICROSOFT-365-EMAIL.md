# Microsoft 365 email setup

Vendure sends production email through Microsoft Graph with application authentication. Exchange Online Basic authentication and app passwords are not used.

## Microsoft Entra setup

1. Register an application for the Vendure server in the Janvey Microsoft Entra tenant.
2. Add the Microsoft Graph **Application** permission `Mail.Send`.
3. Grant tenant administrator consent for that permission.
4. The initial delivery test can use the tenant-wide `Mail.Send` grant. Before production, replace that unscoped grant with Exchange Online Application RBAC using the `Application Mail.Send` role and a scope containing only the generic sender mailbox. Microsoft advises against creating new legacy Application Access Policies.
5. Create a client secret for initial testing. Store its value only in the deployment secret store or the untracked `apps/server/.env` file.

## Local test configuration

Copy the email variables from `.env.example` into the untracked `.env`, then set:

```dotenv
EMAIL_TRANSPORT=microsoft-graph
EMAIL_FROM_ADDRESS="Janvey <sjanvey@janvey.com>"
M365_TENANT_ID=<Directory tenant ID>
M365_CLIENT_ID=<Application client ID>
M365_CLIENT_SECRET=<Client secret value>
M365_SENDER_MAILBOX=sjanvey@janvey.com
```

Use `EMAIL_TRANSPORT=file` to return to the local development mailbox without removing the Microsoft 365 settings.

The first live Graph request was accepted and delivered on 2026-09-24 using `sjanvey@janvey.com` as both sender and recipient. This validates the configured tenant, application permission, client credential, sender mailbox, MIME generation, Graph request, and mailbox delivery.

A complete Vendure onboarding run also delivered the contact invitation and account-verification messages through Microsoft 365. The recipient registered, verified the mailbox, signed in, and accepted the invitation successfully.

## Production mailbox change

After the generic mailbox exists, add it to the application's allowed mailbox scope and change only `EMAIL_FROM_ADDRESS` and `M365_SENDER_MAILBOX`. The Entra application credentials can remain the same.
