import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from './Pages/Login'
import Layout from "./Layout/Layout";
import { Provider } from 'react-redux';
import Store from "./Store";
import Home from './Pages/index/Home'
import './css/main.css'
import './css/mobile.css'
import PrivateRoute from "./component/PrivateRoute";
import ImportNew from "./Pages/import/ImportNew";
import InvoiceDetail from "./Pages/invoice/InvoiceDetail";
import ImportAI from "./Pages/import/ImportAI";
import ImportGemini from "./Pages/import/ImportGemini";

const App = () => {
  return (
    <Provider store={Store}>
      <Router>
        <Layout>
          <Routes>
            <Route exact path="/" Component={Home}></Route>
            <Route path="login/" Component={Login}></Route>
            <Route path="/importnew" element={<PrivateRoute><ImportNew /></PrivateRoute>}></Route>
            <Route path="/invoicedetail/:id" element={<PrivateRoute><InvoiceDetail /></PrivateRoute>}></Route>
            <Route path="/import-ai" element={<PrivateRoute><ImportAI /></PrivateRoute>}></Route>
            <Route path="/import-gemini" element={<PrivateRoute><ImportGemini /></PrivateRoute>}></Route>
          </Routes>
        </Layout>
      </Router>
    </Provider>
  )
}

export default App;
