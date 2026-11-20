// Privacy and Terms: placeholder structure with the sections most products need. Have a lawyer review the real text.
import { Container, Heading, Prose } from "../components/ui";
import { APP_NAME, CONTACT_EMAIL } from "../data/site";
import { useTitle } from "../lib/useTitle";

const updated = "2026-11-08";

export function Privacy() {
  useTitle(`Privacy — ${APP_NAME}`);
  return (
    <Container rails className="flex flex-col gap-10 pt-16 pb-20 lg:pt-24">
      <Heading as="h1" title="Privacy policy" muted={`Last updated ${updated}.`} />
      <Prose>
        <h2 className="text-[22px] font-medium">What we collect</h2>
        <p>
          Your name and email when you sign up; the content you and your team add to your organization; and the usage data needed to run and
          bill the service.
        </p>
        <h2 className="text-[22px] font-medium">How we use it</h2>
        <p>
          To provide the service, send the emails you ask for (sign-in links, invitations, receipts), and keep the service secure. We don't
          sell your data.
        </p>
        <h2 className="text-[22px] font-medium">Providers</h2>
        <p>
          Your data is processed by the infrastructure and model providers you connect, under their own terms. Keys you give us are
          encrypted at rest.
        </p>
        <h2 className="text-[22px] font-medium">Your rights</h2>
        <p>
          You can export or delete your organization at any time from Settings. For anything else, write to{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-4">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </Prose>
    </Container>
  );
}

export function Terms() {
  useTitle(`Terms — ${APP_NAME}`);
  return (
    <Container rails className="flex flex-col gap-10 pt-16 pb-20 lg:pt-24">
      <Heading as="h1" title="Terms of service" muted={`Last updated ${updated}.`} />
      <Prose>
        <h2 className="text-[22px] font-medium">The service</h2>
        <p>
          {APP_NAME} is provided as is, on the plan you choose. We may change features with notice and will keep your data available for
          export.
        </p>
        <h2 className="text-[22px] font-medium">Your account</h2>
        <p>
          You're responsible for what happens under your account and for the content your organization adds. Don't use the service for
          anything unlawful.
        </p>
        <h2 className="text-[22px] font-medium">Billing</h2>
        <p>Paid plans renew monthly until cancelled. Usage past a plan's allowance is charged as the plan states.</p>
        <h2 className="text-[22px] font-medium">Contact</h2>
        <p>
          Questions about these terms:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-4">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </Prose>
    </Container>
  );
}
