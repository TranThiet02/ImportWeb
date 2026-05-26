import { combineReducers } from "redux";
import AuthReducer from './AuthReducer';
import InvoiceReducer from "../reducer/invoicesupgrade/InvoiceReducer";
import InvoiceAIReducer from '../reducer/invoiceai/InvoiceAIReducer'
import InvoiceGeminiReducer from "./invoicegemini/InvoiceGeminiReducer";
import InvoiceManualReducer from "./invoicesupgrade/InvoiceManualReducer";

const MainReducer = combineReducers({
    AuthReducer,
    InvoiceReducer,
    InvoiceManualReducer,
    InvoiceAIReducer,
    InvoiceGeminiReducer,
});

export default MainReducer;