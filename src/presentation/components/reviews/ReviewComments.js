"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/presentation/contexts/LanguageContext";

const MAX_COMMENT_LENGTH = 500;

export default function ReviewComments({
  reviewId,
  sectionId,
  onCommentCountChange,
}) {
  const { status: sessionStatus } = useSession();
  const { t } = useLanguage();
  const [comments, setComments] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    totalComments: 0,
    hasNextPage: false,
  });
  const [commentText, setCommentText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState("");
  const [loadError, setLoadError] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [deleteMessage, setDeleteMessage] = useState("");

  const loadComments = useCallback(
    async ({ page = 1, append = false, signal } = {}) => {
      append ? setIsLoadingMore(true) : setIsLoading(true);
      setLoadError("");

      try {
        const response = await fetch(
          `/api/reviews/${reviewId}/comments?page=${page}`,
          { cache: "no-store", signal }
        );
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(result.message || t("reviewCommentsLoadFailed"));
        }

        const nextComments = Array.isArray(result.data) ? result.data : [];
        setComments((currentComments) => {
          if (!append) {
            return nextComments;
          }

          const existingIds = new Set(
            currentComments.map((comment) => comment.id)
          );
          return [
            ...currentComments,
            ...nextComments.filter((comment) => !existingIds.has(comment.id)),
          ];
        });
        setPagination({
          page: Number(result.pagination?.page) || page,
          totalComments: Number(result.pagination?.totalComments) || 0,
          hasNextPage: Boolean(result.pagination?.hasNextPage),
        });
        onCommentCountChange?.(
          Number(result.pagination?.totalComments) || 0
        );
      } catch (error) {
        if (error.name !== "AbortError") {
          setLoadError(error.message || t("reviewCommentsLoadFailed"));
        }
      } finally {
        append ? setIsLoadingMore(false) : setIsLoading(false);
      }
    },
    [onCommentCountChange, reviewId, t]
  );

  useEffect(() => {
    const controller = new AbortController();
    const loadTimer = window.setTimeout(() => {
      loadComments({ signal: controller.signal });
    }, 0);

    return () => {
      window.clearTimeout(loadTimer);
      controller.abort();
    };
  }, [loadComments]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (sessionStatus !== "authenticated" || isPosting) {
      return;
    }

    const normalizedText = commentText.trim();

    if (!normalizedText) {
      setFormMessage(t("reviewCommentRequired"));
      return;
    }

    try {
      setIsPosting(true);
      setFormMessage("");
      const response = await fetch(`/api/reviews/${reviewId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentText: normalizedText }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || t("reviewCommentPostFailed"));
      }

      setComments((currentComments) => [
        result.data,
        ...currentComments.filter((comment) => comment.id !== result.data.id),
      ]);
      setPagination((currentPagination) => ({
        ...currentPagination,
        totalComments: Number(result.commentCount) || 0,
      }));
      onCommentCountChange?.(Number(result.commentCount) || 0);
      setCommentText("");
    } catch (error) {
      setFormMessage(error.message || t("reviewCommentPostFailed"));
    } finally {
      setIsPosting(false);
    }
  }

  async function handleDelete(commentId) {
    if (
      deletingCommentId ||
      !window.confirm(t("reviewDeleteCommentConfirm"))
    ) {
      return;
    }

    try {
      setDeletingCommentId(commentId);
      setDeleteMessage("");
      const response = await fetch(
        `/api/reviews/${reviewId}/comments/${commentId}`,
        { method: "DELETE" }
      );
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 404) {
          await loadComments();
        }
        throw new Error(result.message || t("reviewCommentDeleteFailed"));
      }

      setComments((currentComments) =>
        currentComments.filter((comment) => comment.id !== commentId)
      );
      setPagination((currentPagination) => ({
        ...currentPagination,
        totalComments: Number(result.commentCount) || 0,
      }));
      onCommentCountChange?.(Number(result.commentCount) || 0);
      await loadComments();
    } catch (error) {
      setDeleteMessage(error.message || t("reviewCommentDeleteFailed"));
    } finally {
      setDeletingCommentId("");
    }
  }

  return (
    <section
      id={sectionId}
      aria-label={t("reviewComments")}
      className="mt-5 border-t border-attraction-border pt-5 sm:ml-[72px]"
    >
      {isLoading ? (
        <p role="status" className="text-sm text-attraction-muted">
          {t("reviewCommentsLoading")}
        </p>
      ) : loadError ? (
        <div role="alert" className="rounded-[10px] bg-[#FDECEC] p-4">
          <p className="text-sm text-attraction-error">{loadError}</p>
          <button
            type="button"
            onClick={() => loadComments()}
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-[10px] border border-attraction-error px-4 text-sm font-semibold text-attraction-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-attraction-primary"
          >
            {t("reviewCommentsRetry")}
          </button>
        </div>
      ) : (
        <>
          {comments.length === 0 ? (
            <div className="rounded-[10px] bg-attraction-surface-soft px-4 py-5 text-sm text-attraction-body">
              <p className="font-semibold text-attraction-ink">
                {t("reviewNoCommentsYet")}
              </p>
              <p className="mt-1">{t("reviewBeFirstToComment")}</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  isDeleting={deletingCommentId === comment.id}
                  onDelete={handleDelete}
                  t={t}
                />
              ))}
            </ul>
          )}

          {pagination.hasNextPage && (
            <button
              type="button"
              disabled={isLoadingMore}
              onClick={() =>
                loadComments({ page: pagination.page + 1, append: true })
              }
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-[10px] border border-attraction-border-strong bg-white px-4 text-sm font-semibold text-attraction-primary-dark transition-colors duration-200 hover:bg-attraction-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-attraction-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoadingMore
                ? t("reviewCommentsLoading")
                : t("reviewViewMoreComments")}
            </button>
          )}
        </>
      )}

      {deleteMessage && (
        <p role="alert" className="mt-3 text-sm text-attraction-error">
          {deleteMessage}
        </p>
      )}

      {sessionStatus === "authenticated" ? (
        <form onSubmit={handleSubmit} className="mt-5">
          <label
            htmlFor={`review-comment-${reviewId}`}
            className="block text-sm font-semibold text-attraction-ink"
          >
            {t("reviewWriteComment")}
          </label>
          <textarea
            id={`review-comment-${reviewId}`}
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
            maxLength={MAX_COMMENT_LENGTH}
            rows={3}
            disabled={isPosting}
            placeholder={t("reviewCommentPlaceholder")}
            className="mt-2 w-full resize-y rounded-[10px] border border-attraction-border-strong bg-white px-4 py-3 text-sm leading-relaxed text-attraction-ink placeholder:text-attraction-muted focus:border-attraction-primary focus:outline-none focus:ring-2 focus:ring-attraction-primary/30 disabled:opacity-60"
          />
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-attraction-muted" aria-live="polite">
              {t("reviewCommentCharacterCount", {
                count: commentText.length,
                maximum: MAX_COMMENT_LENGTH,
              })}
            </p>
            <button
              type="submit"
              disabled={isPosting || !commentText.trim()}
              className="inline-flex min-h-[46px] items-center justify-center rounded-[10px] bg-attraction-primary px-5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-attraction-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-attraction-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPosting
                ? t("reviewPostingComment")
                : t("reviewPostComment")}
            </button>
          </div>
          {formMessage && (
            <p role="alert" className="mt-2 text-sm text-attraction-error">
              {formMessage}
            </p>
          )}
        </form>
      ) : sessionStatus === "unauthenticated" ? (
        <p className="mt-5 text-sm text-attraction-body">
          <Link
            href="/login"
            className="font-semibold text-attraction-primary-dark underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-attraction-primary"
          >
            {t("reviewSignInToComment")}
          </Link>
        </p>
      ) : (
        <p role="status" className="mt-5 text-sm text-attraction-muted">
          {t("loading")}
        </p>
      )}
    </section>
  );
}

function CommentItem({ comment, isDeleting, onDelete, t }) {
  const reviewerName = comment.reviewer?.name || "Chatlas traveller";
  const reviewerHref = createProfileHref(comment.reviewer?.id);
  const avatar = comment.reviewer?.avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={comment.reviewer.avatar}
      alt={`${reviewerName}'s profile`}
      className="h-11 w-11 rounded-full object-cover"
    />
  ) : (
    <span
      aria-hidden="true"
      className="flex h-11 w-11 items-center justify-center rounded-full bg-attraction-primary-soft-strong text-sm font-semibold text-attraction-primary-dark"
    >
      {getInitials(reviewerName)}
    </span>
  );

  return (
    <li className="flex items-start gap-3">
      {reviewerHref ? (
        <Link
          href={reviewerHref}
          aria-label={`${reviewerName} — ${t("publicTravellerProfile")}`}
          className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-attraction-primary"
        >
          {avatar}
        </Link>
      ) : (
        <span className="shrink-0">{avatar}</span>
      )}

      <div className="min-w-0 flex-1 rounded-[12px] bg-attraction-surface-soft px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-attraction-ink">
              {reviewerHref ? (
                <Link
                  href={reviewerHref}
                  className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-attraction-primary"
                >
                  {reviewerName}
                </Link>
              ) : (
                reviewerName
              )}
            </p>
            <time
              dateTime={comment.createdAt || undefined}
              className="text-xs text-attraction-muted"
            >
              {formatCommentDate(comment.createdAt)}
            </time>
          </div>

          {comment.canDelete && (
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => onDelete(comment.id)}
              className="inline-flex min-h-11 items-center justify-center rounded-[10px] px-3 text-xs font-semibold text-attraction-error transition-colors duration-200 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-attraction-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeleting
                ? t("reviewDeletingComment")
                : t("reviewDeleteComment")}
            </button>
          )}
        </div>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-attraction-body">
          {comment.commentText}
        </p>
      </div>
    </li>
  );
}

function createProfileHref(value) {
  const id = typeof value === "string" ? value.trim() : "";
  return /^[a-f\d]{24}$/i.test(id) ? `/profiles/${id}` : "";
}

function getInitials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatCommentDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
