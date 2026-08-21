import { Link } from "react-router-dom";

import { NOT_FOUND_PAGE_MESSAGES } from "../constants/NotFoundPageMessages";
import { PAGE_NAMES } from "../constants/PageName";

export function NotFoundPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-6 py-8">
        <section className="w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-teal-700">AssetFlow</p>
          <p className="mt-4 text-sm font-semibold tracking-[0.24em] text-slate-400">
            404 NOT FOUND
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950">
            {NOT_FOUND_PAGE_MESSAGES.title}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-600">
            {NOT_FOUND_PAGE_MESSAGES.description}
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              className="inline-flex h-11 items-center justify-center rounded-md bg-teal-700 px-5 text-sm font-medium text-white transition hover:bg-teal-800"
              to="/"
            >
              {NOT_FOUND_PAGE_MESSAGES.backToAssetList}
            </Link>
            <Link
              className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              to="/my-requests"
            >
              {NOT_FOUND_PAGE_MESSAGES.backToMyRequests}
            </Link>
          </div>

          <p className="mt-6 text-xs text-slate-400">
            {PAGE_NAMES.assetList} / {PAGE_NAMES.myRequests}
          </p>
        </section>
      </div>
    </main>
  );
}
