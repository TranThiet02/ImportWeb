import { useEffect } from "react";
import { verify, googleLogin, getUser } from "../reducer/Actions";
import { useLocation } from "react-router-dom";
import queryString from "query-string";
import { connect } from "react-redux";
import Alert from "../component/Alert"
import Navbar from "../component/Navbar"

const Layout = (props) => {
    let location = useLocation();
    useEffect(() => {
        props.verify();
        props.getUser();
    }, []);
    return (
        <div>
            < Navbar />
            {props.message? <Alert message={props.message}/>: null}
            {props.children}
        </div>
    )
}

const mapStateToProps = (state) => {
    return {
        message: state.AuthReducer.message,
        access: state.AuthReducer.access,
        refresh: state.AuthReducer.refresh,
        isAuthenticated: state.AuthReducer.isAuthenticated,
        user: state.AuthReducer.user
    }
}

export default connect(mapStateToProps, { verify, getUser, googleLogin })(Layout);