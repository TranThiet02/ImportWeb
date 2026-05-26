import React, { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { login, googleLogin } from "../reducer/Actions";
import { connect } from "react-redux";
import { GoogleLogin } from '@react-oauth/google';

const Login = ({ login, googleLogin, isAuthenticated }) => {
    const [getInput, setInput] = useState({
        email: '',
        password: ''
    });
    const { email, password } = getInput;
    const handleInput = (e) => setInput({...getInput, [e.target.name]: e.target.value});
    const handleSubmit = (e) => {
        e.preventDefault();
        login(email, password);
    }

    if (isAuthenticated) {
        return <Navigate to={'/'} />;
    }

    return (
        <div className="login-wrapper">
            <div className="login-container">

                <div className="login-card">

                    <h3 className="login-title">
                        Đăng nhập tài khoản
                    </h3>

                    <form
                        encType="multipart/form-data"
                        onSubmit={handleSubmit}
                    >

                        <div className="form-group-custom">
                            <input
                                type="email"
                                name="email"
                                className="form-control"
                                placeholder="Email"
                                onChange={handleInput}
                            />
                        </div>

                        <div className="form-group-custom">
                            <input
                                type="password"
                                name="password"
                                className="form-control"
                                placeholder="Password"
                                onChange={handleInput}
                            />
                        </div>

                        <button
                            type="submit"
                            className="login-btn-custom"
                        >
                            Đăng nhập
                        </button>

                        <div className="divider">
                            <span>OR</span>
                        </div>

                        <div className="google-btn-wrapper">
                            <GoogleLogin
                                onSuccess={(credentialResponse) => {
                                    googleLogin(
                                        credentialResponse.credential
                                    );
                                }}
                                onError={() =>
                                    console.log('Login Failed')
                                }
                            />
                        </div>

                    </form>
                </div>
            </div>
        </div>
    );
}

const mapStateToProps = (state) => {
    return {
        isAuthenticated: state.AuthReducer.isAuthenticated
    }
}

export default connect(mapStateToProps, { login, googleLogin })(Login);