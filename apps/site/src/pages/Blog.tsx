import { Link, Navigate, useParams } from "react-router";
import { Container, Heading, Prose } from "../components/ui";
import { APP_NAME, posts } from "../data/site";
import { useTitle } from "../lib/useTitle";

const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

export function BlogIndex() {
  useTitle(`Blog — ${APP_NAME}`);
  return (
    <Container rails className="flex flex-col gap-10 pt-16 pb-20 lg:pt-24">
      <Heading as="h1" title="Blog" muted="Notes from the team." />
      <ul className="divide-y divide-line border-y border-line">
        {posts.map((p) => (
          <li key={p.slug} className="py-6">
            <Link to={`/blog/${p.slug}`} className="group flex flex-col gap-1.5">
              <span className="font-mono text-[12px] text-subtle">{fmt(p.date)}</span>
              <span className="text-[22px] font-medium group-hover:underline group-hover:underline-offset-4">{p.title}</span>
              <span className="max-w-[64ch] text-[15.5px] text-muted">{p.excerpt}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}

export function BlogPost() {
  const { slug } = useParams();
  const post = posts.find((p) => p.slug === slug);
  useTitle(post ? `${post.title} — ${APP_NAME}` : APP_NAME);
  if (!post) return <Navigate to="/blog" replace />;
  return (
    <Container rails className="flex flex-col gap-10 pt-16 pb-20 lg:pt-24">
      <div className="mx-auto flex max-w-[68ch] flex-col gap-3">
        <span className="font-mono text-[12px] text-subtle">{fmt(post.date)}</span>
        <h1 className="font-display text-[40px] leading-[1] sm:text-[48px]">{post.title}</h1>
      </div>
      <Prose>
        {post.body.map((para, i) => (
          <p key={i}>{para}</p>
        ))}
        <p>
          <Link to="/blog" className="text-muted underline underline-offset-4 hover:text-fg">
            ← All posts
          </Link>
        </p>
      </Prose>
    </Container>
  );
}
