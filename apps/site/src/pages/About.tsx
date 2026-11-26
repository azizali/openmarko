import { Container, Heading, Prose } from "../components/ui";
import { APP_NAME, CONTACT_EMAIL } from "../data/site";
import { useTitle } from "../lib/useTitle";

export default function About() {
  useTitle(`About — ${APP_NAME}`);
  return (
    <>
      <Container rails className="flex flex-col gap-10 pt-16 pb-20 lg:pt-24">
        <Heading as="h1" title="About" muted="us." />
        <Prose>
          <p>Placeholder copy. Say who you are, why you built this, and who it's for.</p>
          <p>
            A good about page answers three questions in order: what the product does, why it exists, and who is behind it. Keep it short
            and specific; a reader who wants more will write to you.
          </p>
          <p>
            Reach us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-4">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Prose>
      </Container>
    </>
  );
}
