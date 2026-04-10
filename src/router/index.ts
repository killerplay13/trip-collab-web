import { createRouter, createWebHistory } from "vue-router";
import { useSessionStore } from "../stores/session";

const routes = [
  { path: "/", redirect: "/trips/new" },
  { path: "/trips/new", component: () => import("../pages/TripCreatePage.vue") },
  { path: "/t/:tripId/join", component: () => import("../pages/TripJoinPage.vue") },
  {
    path: "/t/:tripId",
    component: () => import("../layouts/AppShellLayout.vue"),
    meta: { requiresToken: true },
    children: [
      { path: "", component: () => import("../pages/TripHomePage.vue") },
      { path: "itinerary", component: () => import("../pages/ItineraryListPage.vue") },
      { path: "expenses", component: () => import("../pages/ExpensesPage.vue") },
      { path: "settlement", component: () => import("../pages/SettlementPage.vue") },
      { path: "notes", component: () => import("../pages/NotesPage.vue") },
    ],
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  const requiresToken = Boolean(to.meta.requiresToken);
  if (!requiresToken) return true;

  const tripId = String(to.params.tripId || "");
  if (!tripId) return "/trips/new";

  const session = useSessionStore();
  const access = session.getTripAccess(tripId);
  if (!access?.memberToken) {
    const tripToken =
      typeof to.query.token === "string" && to.query.token.trim()
        ? to.query.token
        : session.getTripToken(tripId);

    return {
      path: `/t/${tripId}/join`,
      query: {
        ...(tripToken ? { token: tripToken } : {}),
        redirect: to.fullPath,
      },
    };
  }

  return true;
});
