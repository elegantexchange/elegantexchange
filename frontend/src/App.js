import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "@/App.css";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Consignors from "@/pages/Consignors";
import ConsignorDetail from "@/pages/ConsignorDetail";
import Inventory from "@/pages/Inventory";
import Sales from "@/pages/Sales";
import Payouts from "@/pages/Payouts";
import Analytics from "@/pages/Analytics";
import Settings from "@/pages/Settings";
import TagPrint from "@/pages/TagPrint";

function OwnerOnly({ children }) {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role !== "owner") return <Navigate to="/" replace />;
  return children;
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/print/tags" element={<TagPrint />} />
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="/consignors" element={<Consignors />} />
              <Route path="/consignors/:id" element={<ConsignorDetail />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/sales" element={<Sales />} />
              <Route
                path="/payouts"
                element={
                  <OwnerOnly>
                    <Payouts />
                  </OwnerOnly>
                }
              />
              <Route
                path="/analytics"
                element={
                  <OwnerOnly>
                    <Analytics />
                  </OwnerOnly>
                }
              />
              <Route
                path="/settings"
                element={
                  <OwnerOnly>
                    <Settings />
                  </OwnerOnly>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
