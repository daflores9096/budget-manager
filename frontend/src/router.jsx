import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppLayout from './layouts/AppLayout.jsx';
import DashboardRoute from './pages/DashboardRoute.jsx';
import IncomesRoute from './pages/IncomesRoute.jsx';
import ExpensesRoute from './pages/ExpensesRoute.jsx';
import CategoriesRoute from './pages/CategoriesRoute.jsx';
import FixedRecurringRoute from './pages/FixedRecurringRoute.jsx';

export const router = createBrowserRouter([
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
      { path: '*', element: <Navigate to="/dashboard" replace /> },
    ],
  },
]);

