import type { Instrumentation } from "next";
import {
  createStructuredErrorEvent,
  normalizeRequestPath,
} from "@/lib/observability/errorReporting";

export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context
) => {
  console.error(
    JSON.stringify(
      createStructuredErrorEvent({
        error,
        event: "next_request_error",
        source: "server",
        context: {
          method: request.method,
          path: normalizeRequestPath(request.path),
          routerKind: context.routerKind,
          routePath: context.routePath,
          routeType: context.routeType,
          renderSource: context.renderSource,
          revalidateReason: context.revalidateReason,
        },
      })
    )
  );
};
