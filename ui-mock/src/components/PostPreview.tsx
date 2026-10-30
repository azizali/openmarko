import { Fragment, type ReactNode } from "react";
import { AudioWaveform, Bookmark, CalendarCheck, ChartNoAxesColumn, Ellipsis, Globe, Heart, MessageCircle, MessageSquare, Phone, Play, Repeat2, Send, Share2, ThumbsUp } from "lucide-react";
import { cn } from "./ui";
import { channelOf, type ChannelId } from "../data/social";
import { brandFacts } from "../data/brand";

// How a post will look on each platform: the platform's layout, where the text
// gets cut off ("… more"), hashtags, and the media slot. Not pixel copies of each
// app, just close enough to judge the hook, the length and the crop.

type Props = { channel: ChannelId; text: string; format: string; hook?: string };

const isVideo = (format: string) => /reel|tiktok|video|\d+s\b/i.test(format);

/** Hashtags and @mentions in the platform's link color. */
function Rich({ text, color }: { text: string; color: string }) {
  return (
    <>
      {text.split(/([#@][\w.]+)/g).map((part, i) =>
        /^[#@][\w.]+$/.test(part) ? <span key={i} style={{ color }}>{part}</span> : <Fragment key={i}>{part}</Fragment>,
      )}
    </>
  );
}

/** Cuts text where the platform folds it, and adds that platform's "more". */
function Folded({ text, at, more, color, className, lead }: { text: string; at: number; more: string; color: string; className?: string; lead?: ReactNode }) {
  const cut = text.length > at;
  return (
    <p className={cn("m-0 whitespace-pre-line", className)}>
      {lead}
      <Rich text={cut ? text.slice(0, at).trimEnd() : text} color={color} />
      {cut && <span className="text-muted">… {more}</span>}
    </p>
  );
}

function Avatar({ size = 32, square = false }: { size?: number; square?: boolean }) {
  return <span className={cn("grid shrink-0 place-items-center bg-ink font-semibold text-on-ink", square ? "rounded-md" : "rounded-full")} style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden>M</span>;
}

/** The media slot: an image made from the hook, or the first frame of the video. */
function Media({ hook, video, className }: { hook: string; video: boolean; className: string }) {
  return (
    <div className={cn("relative grid place-items-center overflow-hidden bg-[linear-gradient(140deg,#3b1a2e,#9d2a6a_55%,#f08bbf)] px-6 text-center", className)}>
      <span className="font-serif text-[22px] leading-tight text-white">{hook}</span>
      {video && <span className="absolute grid size-11 place-items-center rounded-full bg-black/35 text-white"><Play size={18} className="ml-0.5 fill-current" /></span>}
      <span className="absolute bottom-2 left-2 rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-white">{video ? "Video · your footage goes here" : "Image · made from your hook"}</span>
    </div>
  );
}

const firstLine = (t: string) => t.split("\n")[0].replace(/#[\w.]+/g, "").trim();
const Frame = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("w-full max-w-[340px] overflow-hidden rounded-xl border border-line bg-surface text-[13px] leading-[1.45] text-fg shadow-card", className)}>{children}</div>
);

export function PostPreview({ channel, text, format, hook }: Props) {
  const c = channelOf(channel);
  const h = hook || firstLine(text) || "Your post";
  const video = isVideo(format);
  const now = <span className="text-muted">Just now</span>;

  if (channel === "instagram") return (
    <Frame>
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <Avatar size={30} />
        <div className="min-w-0 flex-1 leading-tight"><div className="truncate text-[13px] font-semibold">{c.handle.replace("@", "")}</div><div className="text-[11px] text-muted">Austin, Texas</div></div>
        <Ellipsis size={16} className="text-muted" />
      </div>
      <Media hook={h} video={video} className="aspect-[4/5]" />
      <div className="flex items-center gap-3.5 px-3 pt-2.5"><Heart size={21} /><MessageCircle size={21} /><Send size={20} /><Bookmark size={20} className="ml-auto" /></div>
      <div className="px-3 pt-2 pb-3">
        <Folded lead={<b className="font-semibold">{c.handle.replace("@", "")} </b>} text={text} at={110} more="more" color="#00376b" />
        <div className="mt-1 text-[11px]">{now}</div>
      </div>
    </Frame>
  );

  if (channel === "tiktok") return (
    <div className="relative aspect-[9/16] w-full max-w-[260px] overflow-hidden rounded-xl bg-[linear-gradient(170deg,#1b1b1b,#3a1f2f_60%,#111)] text-[12.5px] leading-snug text-white">
      <p className="absolute inset-x-5 top-[22%] m-0 text-center text-[19px] leading-tight font-extrabold" style={{ textShadow: "0 0 3px #000, 0 2px 6px rgba(0,0,0,.6)" }}>{h}</p>
      <div className="absolute right-2.5 bottom-24 flex flex-col items-center gap-4 text-[10.5px]">
        <span className="rounded-full ring-2 ring-white"><Avatar size={36} /></span>
        <span className="flex flex-col items-center gap-0.5"><Heart size={26} className="fill-current" />0</span>
        <span className="flex flex-col items-center gap-0.5"><MessageCircle size={25} className="fill-current" />0</span>
        <span className="flex flex-col items-center gap-0.5"><Bookmark size={24} className="fill-current" />0</span>
        <span className="flex flex-col items-center gap-0.5"><Share2 size={24} />Share</span>
      </div>
      <div className="absolute inset-x-3 bottom-3 pr-12">
        <div className="font-semibold">{c.handle}</div>
        <Folded text={text} at={80} more="more" color="#fff" className="mt-1 [&_span]:font-semibold" />
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] opacity-90"><AudioWaveform size={12} /> original sound · {brandFacts.name}</div>
      </div>
    </div>
  );

  if (channel === "x") {
    const over = text.length - 280;
    return (
      <Frame className="px-3.5 py-3">
        <div className="flex gap-2.5">
          <Avatar size={38} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1 text-[13.5px]"><b className="truncate font-bold">{brandFacts.name}</b><span className="truncate text-muted">{c.handle} · now</span></div>
            <p className="mt-0.5 mb-0 text-[14px] whitespace-pre-line"><Rich text={over > 0 ? text.slice(0, 280) : text} color="#1d9bf0" />{over > 0 && <span className="bg-bad-soft text-bad">{text.slice(280)}</span>}</p>
            {video && <Media hook={h} video className="mt-2.5 aspect-video rounded-2xl border border-line" />}
            <div className="mt-2.5 flex justify-between pr-4 text-muted"><MessageCircle size={16} /><Repeat2 size={17} /><Heart size={16} /><ChartNoAxesColumn size={16} /><Bookmark size={16} /></div>
          </div>
        </div>
        <div className={cn("num mt-2 text-right text-[11px]", over > 0 ? "font-medium text-bad" : "text-subtle")}>{text.length}/280{over > 0 && ` · ${over} over`}</div>
      </Frame>
    );
  }

  if (channel === "linkedin") return (
    <Frame>
      <div className="flex gap-2.5 px-3 pt-3">
        <Avatar size={40} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-[13.5px] font-semibold">{c.handle}</div>
          <div className="truncate text-[11.5px] text-muted">Dentist and owner, {brandFacts.name}</div>
          <div className="flex items-center gap-1 text-[11.5px] text-muted">now · <Globe size={11} /></div>
        </div>
      </div>
      <Folded text={text} at={210} more="see more" color="#0a66c2" className="px-3 py-2.5" />
      {video && <Media hook={h} video className="aspect-video" />}
      <div className="mx-3 flex justify-between border-t border-line py-2 text-[12px] font-medium text-muted">
        <span className="flex items-center gap-1"><ThumbsUp size={15} /> Like</span><span className="flex items-center gap-1"><MessageSquare size={15} /> Comment</span><span className="flex items-center gap-1"><Repeat2 size={15} /> Repost</span><span className="flex items-center gap-1"><Send size={15} /> Send</span>
      </div>
    </Frame>
  );

  if (channel === "facebook") return (
    <Frame>
      <div className="flex items-center gap-2.5 px-3 pt-3">
        <Avatar size={38} />
        <div className="min-w-0 flex-1 leading-tight"><div className="text-[13.5px] font-semibold">{brandFacts.name}</div><div className="flex items-center gap-1 text-[11.5px] text-muted">Just now · <Globe size={11} /></div></div>
        <Ellipsis size={16} className="text-muted" />
      </div>
      <Folded text={text} at={320} more="See more" color="#1877f2" className="px-3 py-2.5" />
      <Media hook={h} video={video} className="aspect-[1.91/1]" />
      <div className="mx-3 flex justify-around border-t border-line py-2 text-[12.5px] font-medium text-muted">
        <span className="flex items-center gap-1.5"><ThumbsUp size={15} /> Like</span><span className="flex items-center gap-1.5"><MessageCircle size={15} /> Comment</span><span className="flex items-center gap-1.5"><Share2 size={15} /> Share</span>
      </div>
    </Frame>
  );

  // Google Business Profile post, as it shows on Search and Maps.
  const cta = /book/i.test(format) ? { label: "Book", icon: CalendarCheck } : /learn/i.test(format) ? { label: "Learn more", icon: null } : { label: "Call now", icon: Phone };
  return (
    <Frame>
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <Avatar size={30} />
        <div className="min-w-0 flex-1 leading-tight"><div className="truncate text-[13px] font-medium">{brandFacts.name}</div><div className="text-[11px] text-muted">Just now</div></div>
      </div>
      <Media hook={h} video={false} className="aspect-[4/3]" />
      <Folded text={text} at={180} more="More" color="#1a73e8" className="px-3 pt-2.5" />
      <div className="px-3 pt-2 pb-3">
        <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line px-3.5 text-[12.5px] font-medium" style={{ color: "#1a73e8" }}>{cta.icon && <cta.icon size={13} />}{cta.label}</span>
      </div>
    </Frame>
  );
}
