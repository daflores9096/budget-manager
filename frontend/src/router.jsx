import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppLayout from './layouts/AppLayout.jsx';
import PublicLayout from './layouts/PublicLayout.jsx';
import DashboardRoute from './pages/DashboardRoute.jsx';
import IncomesRoute from './pages/IncomesRoute.jsx';
import ExpensesRoute from './pages/ExpensesRoute.jsx';
import CategoriesRoute from './pages/CategoriesRoute.jsx';
import FixedRecurringRoute from './pages/FixedRecurringRoute.jsx';
import UsersRoute from './pages/UsersRoute.jsx';
import BackupsRoute from './pages/BackupsRoute.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <PublicLayout />,
    children: [
      { path: 'login', element: <LoginPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
    ],
  },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardRoute /> },
      { path: 'incomes', element: <IncomesRoute /> },
      { path: 'expenses', element: <ExpensesRoute /> },
      { path: 'gastos-fijos', element: <FixedRecurringRoute /> },
      { path: 'categories', element: <CategoriesRoute /> },
      { path: 'users', element: <UsersRoute /> },
      { path: 'backups', element: <BackupsRoute /> },
      { path: '*', element: <Navigate to="/dashboard" replace /> },
    ],
  },
]);

