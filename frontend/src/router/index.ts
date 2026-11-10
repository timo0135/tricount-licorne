import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/RegisterView.vue'),
      meta: { public: true },
    },
    { path: '/', name: 'groups', component: () => import('@/views/GroupsView.vue') },
    { path: '/groups/new', name: 'group-new', component: () => import('@/views/GroupFormView.vue') },
    { path: '/groups/join', name: 'group-join', component: () => import('@/views/JoinGroupView.vue') },
    {
      path: '/groups/:id',
      name: 'group',
      component: () => import('@/views/GroupView.vue'),
      props: true,
    },
    {
      path: '/groups/:id/settings',
      name: 'group-settings',
      component: () => import('@/views/GroupSettingsView.vue'),
      props: true,
    },
    {
      path: '/groups/:id/families/new',
      name: 'family-new',
      component: () => import('@/views/FamilyFormView.vue'),
      props: true,
    },
    {
      path: '/groups/:id/families/:familyId',
      name: 'family-edit',
      component: () => import('@/views/FamilyFormView.vue'),
      props: true,
    },
    {
      path: '/groups/:id/expenses/new',
      name: 'expense-new',
      component: () => import('@/views/ExpenseFormView.vue'),
      props: true,
    },
    {
      path: '/groups/:id/expenses/:expenseId',
      name: 'expense-edit',
      component: () => import('@/views/ExpenseFormView.vue'),
      props: true,
    },
    {
      path: '/groups/:id/coefficients',
      name: 'coefficients',
      component: () => import('@/views/CoefficientsView.vue'),
      props: true,
    },
    {
      path: '/groups/:id/settle',
      name: 'settle',
      component: () => import('@/views/SettleView.vue'),
      props: true,
    },
    { path: '/profile', name: 'profile', component: () => import('@/views/ProfileView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.ready) await auth.restore();

  if (!to.meta.public && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  if (to.meta.public && auth.isAuthenticated) {
    return { name: 'groups' };
  }
  return true;
});

export default router;
