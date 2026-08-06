# Event Registration & Ticketing System — Capstone Project Guide
## 1. What I am actually building

My college used **Microsoft Forms + Excel** to register people for events. I am replacing
that with a system where:

- A **website** shows a list of events and a registration form.
- When someone submits the form, a request flies over the internet to **AWS**.
- AWS runs a small piece of code (a **Lambda function**) that checks the event isn't full,
  saves the registration, and updates the count.
- Everything is stored in **DynamoDB** (AWS's database — like an Excel sheet, but built to
  handle thousands of requests at once).
- **API Gateway** is the "front door" — it's the address (URL) your website talks to.
- **CloudWatch** automatically logs everything that happens and can alert you if something breaks.
- **SNS** emails the event organizer whenever someone registers.
- **AWS Budgets** watches your spending so you never get a surprise bill.
- **GitHub Actions** automatically redeploys your system to AWS every time you save (push) new code.

This is called a **serverless architecture** — you never manage a physical server. AWS runs
your code only when someone actually uses it, and you're only charged for that usage
(which, for a student project, is effectively $0 — everything here fits in the AWS Free Tier).

### How the pieces connect

```
[ My Website (HTML/JS) ]
          |
          v  (HTTPS request)
[ API Gateway ]  <-- the address / "front door"
          |
          v
[ Lambda Functions ]  <-- the logic (Python code)
     |            |
     v            v
[ DynamoDB ]   [ SNS ]  --> email to organizer
     |
     v
[ CloudWatch ]  <-- logs + alarms watching everything
```

Everything AWS-side is defined in **one file**: `template.yaml`. This is called
**"Infrastructure as Code"** — instead of clicking around the AWS console to create each
service by hand, you describe what you want in a file, and AWS builds it for you exactly
the same way every time. This is also *why* your GitHub Actions pipeline can redeploy your
whole system automatically

---

## 2. What's in this project folder

```
event-registration-system/
├── template.yaml              AWS infrastructure definition (DynamoDB, Lambda, API Gateway, etc.)
├── src/
│   ├── get_events_handler.py  Lambda function: lists events (GET /events)
│   └── register_handler.py    Lambda function: registers someone (POST /register)
├── scripts/
│   └── seed_events.py         One-off script to add sample events to the database
├── frontend/
│   ├── index.html             The webpage
│   ├── style.css              Styling
│   ├── script.js              Talks to your API
│   └── config.js              Where you paste your deployed API URL
├── .github/workflows/
│   └── deploy.yml             GitHub Actions CI/CD pipeline
├── .gitignore
└── README.md                  This guide
```

---

## 3. Prerequisites — install these first 

Install all of these on my computer before starting:

| Tool | Why you need it | Link |
|---|---|---|
| **VS Code** | Where you'll write/view code | https://code.visualstudio.com |
| **Git** | To push code to GitHub | https://git-scm.com/downloads |
| **Python 3.12+** | Lambda functions and helper scripts | https://www.python.org/downloads |
| **AWS CLI v2** | Lets your computer talk to your AWS account | https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html |
| **AWS SAM CLI** | Builds and deploys `template.yaml` | https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html |
| **A GitHub account** | To host your code and run CI/CD | https://github.com |
| **An AWS account** | Where everything actually runs | https://aws.amazon.com/free |

After installing, verify each one works by opening a terminal (in VS Code: **Terminal → New Terminal**) and running:

```bash
git --version
python3 --version
aws --version
sam --version
```

Each should print a version number. If any command says "not found," reinstall that tool
and restart your terminal.

---

## 4. Set up my AWS account access 

You should **never** use your AWS root account login for daily work. Instead, create an
IAM user with the permissions you need:

1. Log in to the **AWS Console** (https://console.aws.amazon.com) with your root account.
2. Go to **IAM → Users → Create user**.
3. Name it something like `capstone-deployer`.
4. Attach these permissions policies (search and check each box):
   - `AdministratorAccess` — *simplest option for a course project.* (In a real company you'd
     scope this down to only what's needed, but for learning purposes this avoids permission
     errors interrupting your project.)
5. After creating the user, go to the user → **Security credentials** tab → **Create access key**.
   - Choose "Command Line Interface (CLI)" as the use case.
   - AWS will show you an **Access Key ID** and **Secret Access Key**. **Copy both now** —
     the secret key is only shown once.

6. Back in your terminal, run:
   ```bash
   aws configure
   ```
   It will ask for:
   - **AWS Access Key ID** → paste what you copied
   - **AWS Secret Access Key** → paste what you copied
   - **Default region name** → type `us-east-1` (or whichever region you prefer)
   - **Default output format** → type `json`

Your computer can now deploy to your AWS account.

---

## 5. Create your GitHub repository (manual)

1. Go to https://github.com/new
2. Name it, e.g., `event-registration-system`.
3. Leave it **empty** (no README, no .gitignore — we already have our own).
4. Click **Create repository**. Keep the page open — you'll need the URL it shows you.

Now, in VS Code, open a terminal in this project folder and run:

```bash
git init
git add .
git commit -m "Initial commit: serverless event registration system"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/event-registration-system.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username. Refresh your GitHub page — your
files should now be there.

---

## 6. Deploy the backend for the first time (manual, one-time)

The very first deployment is done from your own computer so you can answer setup questions
interactively. After this, GitHub Actions takes over for all future deployments.

In your terminal, inside the project folder:

```bash
sam build
sam deploy --guided
```

`sam deploy --guided` will ask you several questions — here's what to answer:

| Prompt | What to type |
|---|---|
| Stack Name | `event-registration-system` |
| AWS Region | `us-east-1` (or your chosen region) |
| Parameter BudgetNotificationEmail | your email address |
| Parameter OrganizerNotificationEmail | your email address (can be the same one) |
| Confirm changes before deploy | `Y` |
| Allow SAM CLI IAM role creation | `Y` |
| Disable rollback | `N` |
| Save arguments to samconfig.toml | `Y` |

Deployment takes a few minutes. When it finishes, look for an **Outputs** section printed
in the terminal — copy the value next to `ApiUrl`. It looks like:

```
https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod
```

**Important:** Check your email (the `OrganizerNotificationEmail` address) for a message
from AWS titled "AWS Notification - Subscription Confirmation" and click **Confirm
subscription**. If you skip this, you won't receive registration notifications.

---

## 7. Add sample events to your database (manual, one-time)

Your database starts empty. Run the seed script once:

```bash
pip install boto3
python scripts/seed_events.py
```

You should see two lines printed confirming two sample events were added.

---

## 8. Connect your frontend to your API (manual)

Open `frontend/config.js` and replace the placeholder with the `ApiUrl` you copied in Step 6:

```js
const API_BASE_URL = "https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod";
```

Save the file. Now open `frontend/index.html` directly in your browser (double-click it, or
in VS Code right-click → "Open with Live Server" if you have that extension). You should see
your two sample events listed with **Available**/**Limited** badges. Try registering — you
should get a success message, and shortly after, an email notification.

---

## 9. Set up automatic deployment with GitHub Actions (manual, one-time)

This is the "CI/CD pipeline" your project brief asks for. It means: every time you push
code to GitHub, your AWS system updates automatically — no need to run `sam deploy` by hand
again.

1. On GitHub, go to your repo → **Settings → Secrets and variables → Actions**.
2. Click **New repository secret** and add each of these four secrets:

| Secret name | Value |
|---|---|
| `AWS_ACCESS_KEY_ID` | the access key from Step 4 |
| `AWS_SECRET_ACCESS_KEY` | the secret key from Step 4 |
| `BUDGET_EMAIL` | your email address |
| `ORGANIZER_EMAIL` | your email address |

3. Make a small change to any file (e.g., add a comment), then:
   ```bash
   git add .
   git commit -m "Trigger CI/CD pipeline"
   git push
   ```
4. On GitHub, click the **Actions** tab. You'll see your workflow running live. Once it's
   green (✅), your infrastructure has been redeployed automatically from GitHub — that's
   your CI/CD pipeline working.

From now on, **every push to `main` redeploys your project automatically.**

---

## 10. (Optional) Host your frontend on GitHub Pages (manual)

So you have a live link to share, not just a file on your laptop:

1. On GitHub, go to **Settings → Pages**.
2. Under "Build and deployment", choose **Deploy from a branch**.
3. Branch: `main`, folder: `/frontend`. Click **Save**.
4. After a minute, GitHub will show you a live URL like
   `https://YOUR_USERNAME.github.io/event-registration-system/`.

---

## 11. Verify each architecture piece (for your report)

Your brief says: *"the goal is not just to build the application, but to understand the why
behind each architectural decision."* Here's what to check and note down:

- **CloudWatch Logs**: AWS Console → CloudWatch → Log groups → `/aws/lambda/RegisterFunction`.
  You'll see an entry every time someone registers. *Why:* this is how you'd debug problems
  in a real system without needing to reproduce the bug yourself.
- **CloudWatch Alarm**: AWS Console → CloudWatch → Alarms → `RegisterFunction-Errors`.
  *Why:* alerts you automatically if the system starts failing, instead of you finding out
  from angry users.
- **AWS Budgets**: AWS Console → Billing → Budgets. *Why:* prevents surprise charges — critical
  when experimenting with cloud services as a student.
- **IAM**: AWS Console → IAM → Roles → search "RegisterFunction". You'll see a role SAM
  created automatically, with *only* the permissions your function needs (DynamoDB + SNS).
  *Why:* this is the "principle of least privilege" — each piece of your system can only do
  exactly what it needs, limiting damage if something is compromised.
- **DynamoDB**: AWS Console → DynamoDB → Tables → `EventsTable` / `RegistrationsTable`.
  *Why two tables, not one big spreadsheet like before:* DynamoDB scales automatically to
  thousands of simultaneous registrations, something Excel simply can't do.

---

## 12. Cleaning up (avoid charges after you're done)

When you're finished with the project (e.g., after grading), delete everything to make sure
you're never charged:

```bash
sam delete --stack-name event-registration-system
```

Confirm the prompts. This removes every AWS resource this project created.

---

## 13. Troubleshooting

| Problem | Likely cause / fix |
|---|---|
| `sam deploy` fails with a permissions error | Re-check the IAM user has `AdministratorAccess` (Step 4). |
| Frontend shows "Could not load events" | Check `frontend/config.js` — the URL must exactly match your `ApiUrl` output, no trailing slash. |
| No email notification after registering | Confirm your SNS subscription (Step 6) — AWS won't send anything until you click Confirm. |
| GitHub Actions workflow fails | Click into the failed run's logs — the red step tells you exactly what failed. Double-check your 4 secrets are named exactly as in Step 9. |
| `sam build` says "Runtime python3.12 not found" | Make sure Python 3.12 is installed and on your PATH (`python3 --version`). |

---

## 14. What each service is really doing (quick reference for your report)

- **API Gateway** — the public URL/address that receives requests from your website.
- **AWS Lambda** — the actual code that runs, only when triggered (you don't pay when idle).
- **DynamoDB** — a fully-managed NoSQL database (no server to patch or scale yourself).
- **IAM** — controls exactly which AWS resources each part of your system can touch.
- **CloudWatch** — automatic logging + alarms for everything above.
- **SNS** — simple pub/sub messaging service, used here to email the organizer.
- **AWS Budgets** — cost monitoring and alerting.
- **GitHub Actions** — automates your deployment (the CI/CD pipeline).