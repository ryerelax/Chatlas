"use client";

import { useState } from "react";

const STAR_OPTIONS = [1, 2, 3, 4, 5];

export default function ReviewForm() {
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [errors, setErrors] = useState({});
  const [statusMessage, setStatusMessage] = useState("");

  function handleRatingChange(value) {
    setRating(value);
    setStatusMessage("");
    setErrors((current) => ({ ...current, rating: "" }));
  }

  function handleReviewTextChange(event) {
    setReviewText(event.target.value);
    setStatusMessage("");
    setErrors((current) => ({ ...current, reviewText: "" }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = {};

    if (rating < 1 || rating > 5) {
      nextErrors.rating = "Choose a rating from 1 to 5 stars.";
    }

    if (!reviewText.trim()) {
      nextErrors.reviewText = "Enter your review before continuing.";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setStatusMessage("");
      return;
    }

    setStatusMessage(
      "Review submission will be enabled once account authentication is connected."
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mb-8 rounded-[18px] border border-attraction-border bg-white p-[18px] md:p-6"
    >
      <div>
        <fieldset aria-describedby={errors.rating ? "rating-error" : undefined}>
          <legend className="text-base font-semibold text-attraction-ink">
            Your rating <span aria-hidden="true">*</span>
            <span className="sr-only"> (required)</span>
          </legend>

          <div className="mt-3 flex flex-wrap gap-2">
            {STAR_OPTIONS.map((value) => {
              const isSelected = rating === value;
              const isFilled = value <= rating;

              return (
                <label
                  key={value}
                  className={`flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-[10px] border transition-colors duration-200 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-attraction-primary ${
                    isSelected
                      ? "border-attraction-primary bg-attraction-primary-soft ring-1 ring-attraction-primary"
                      : "border-attraction-border-strong bg-white hover:border-attraction-primary hover:bg-attraction-surface-soft"
                  }`}
                >
                  <input
                    type="radio"
                    name="review-rating"
                    value={value}
                    checked={isSelected}
                    onChange={() => handleRatingChange(value)}
                    className="sr-only"
                    aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
                    required
                  />
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      d="m12 2.5 2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.31l-5.8 3.05 1.11-6.46-4.7-4.58 6.49-.94L12 2.5Z"
                      fill={isFilled ? "#FFAB00" : "#FFFFFF"}
                      stroke={isFilled ? "#B7791F" : "#65748A"}
                      strokeWidth="1.5"
                    />
                  </svg>
                  <span className="sr-only">{isSelected ? "Selected" : ""}</span>
                </label>
              );
            })}
          </div>

          <p className="mt-2 text-[13px] font-medium text-attraction-body" aria-live="polite">
            {rating ? `${rating} out of 5 stars selected` : "No rating selected"}
          </p>

          {errors.rating && (
            <p id="rating-error" role="alert" className="mt-2 text-sm text-attraction-error">
              {errors.rating}
            </p>
          )}
        </fieldset>
      </div>

      <div className="mt-6">
        <label htmlFor="review-text" className="text-base font-semibold text-attraction-ink">
          Your review <span aria-hidden="true">*</span>
          <span className="sr-only"> (required)</span>
        </label>
        <textarea
          id="review-text"
          value={reviewText}
          onChange={handleReviewTextChange}
          rows={5}
          maxLength={1000}
          required
          aria-invalid={Boolean(errors.reviewText)}
          aria-describedby={
            errors.reviewText
              ? "review-text-help review-text-count review-text-error"
              : "review-text-help review-text-count"
          }
          placeholder="Share what you enjoyed and what other travellers should know."
          className="mt-3 min-h-[120px] w-full resize-y rounded-[10px] border border-attraction-border-strong bg-white p-3.5 text-base leading-relaxed text-attraction-ink outline-none transition-colors duration-200 placeholder:text-attraction-muted focus:border-attraction-primary focus:ring-2 focus:ring-attraction-primary"
        />
        <div className="mt-2 flex flex-wrap items-start justify-between gap-2 text-[13px] font-medium text-attraction-muted">
          <p id="review-text-help">
            Write a clear and useful review of this attraction.
          </p>
          <p id="review-text-count" aria-live="polite" className="shrink-0">
            {reviewText.length} / 1000
          </p>
        </div>
        {errors.reviewText && (
          <p id="review-text-error" role="alert" className="mt-2 text-sm text-attraction-error">
            {errors.reviewText}
          </p>
        )}
      </div>

      {statusMessage && (
        <div
          role="status"
          className="mt-6 rounded-[10px] bg-[#EAF3FA] px-4 py-3 text-sm leading-relaxed text-attraction-body"
        >
          {statusMessage}
        </div>
      )}

      <button
        type="submit"
        className="mt-6 flex h-[46px] w-full items-center justify-center rounded-[10px] bg-attraction-primary px-5 text-[15px] font-semibold text-white transition-colors duration-200 hover:bg-attraction-primary-hover active:bg-[#004D3E] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-attraction-primary sm:w-auto"
      >
        Submit review
      </button>
    </form>
  );
}
