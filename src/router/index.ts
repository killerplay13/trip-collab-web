import { createRouter, createWebHistory } from "vue-router";
import { useSessionStore } from "../stores/session";

const routes = [
  { path: "/", redirect: "/trips/new" },
  { path: "/trips/new", component: () => import("../pages/TripCreatePage.vue") },
  { path: "/t/:tripId", component: () => import("../pages/TripHomePage.vue"), meta: { requiresToken: true } },
  { path: "/t/:tripId/itinerary", component: () => import("../pages/ItineraryListPage.vue"), meta: { requiresToken: true } },
  { path: "/t/:tripId/expenses", component: () => import("../pages/ExpensesPage.vue"), meta: { requiresToken: true } },
  { path: "/t/:tripId/settlement", component: () => import("../pages/SettlementPage.vue"), meta: { requiresToken: true } },
  { path: "/t/:tripId/notes", component: () => import("../pages/NotesPage.vue"), meta: { requiresToken: true } },
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
  const token = session.getTripToken(tripId);
  if (!token) return "/trips/new";

  return true;
});
