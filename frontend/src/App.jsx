import { Routes, Route } from 'react-router-dom'
import PublicLayout from './layouts/PublicLayout.jsx'
import { RequireAuth, RequireAdmin } from './components/layout/RouteGuards.jsx'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import ItemsList from './pages/ItemsList.jsx'
import ReportForm from './pages/ReportForm.jsx'
import ItemDetails from './pages/ItemDetails.jsx'
import Matches from './pages/Matches.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Admin from './pages/Admin.jsx'
import Profile from './pages/Profile.jsx'
import Notifications from './pages/Notifications.jsx'
import Requests from './pages/Requests.jsx'
import Legal from './pages/Legal.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/lost" element={<ItemsList type="lost" />} />
        <Route path="/found" element={<ItemsList type="found" />} />
        <Route path="/items/:id" element={<ItemDetails />} />
        <Route path="/privacy" element={<Legal page="privacy" />} />
        <Route path="/terms" element={<Legal page="terms" />} />

        <Route element={<RequireAuth />}>
          <Route path="/report/lost" element={<ReportForm type="lost" />} />
          <Route path="/report/found" element={<ReportForm type="found" />} />
          <Route path="/items/:id/edit" element={<ReportForm />} />
          <Route path="/matches" element={<Matches />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/requests" element={<Requests />} />
        </Route>

        <Route element={<RequireAdmin />}>
          <Route path="/admin" element={<Admin />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
