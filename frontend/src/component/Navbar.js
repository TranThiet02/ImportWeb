import React from "react";
import { Link } from "react-router-dom";
import { connect } from "react-redux";
import { logout } from "../reducer/Actions";

const Navbar = ({ logout, isAuthenticated }) => {
    return (
        <header className="custom-navbar fixed-top">
            <div className="container d-flex justify-content-between align-items-center py-3">

                <Link to="/" className="logo text-decoration-none">
                    Import<span>Web</span>
                </Link>

                <nav>
                    <ul className="nav-list">

                        {isAuthenticated ? (
                            <>
                                <li><Link to="/">Home</Link></li>
                                <li><Link className="nav-link" to="/importnew">Import Data</Link></li>
                                <li><Link className="nav-link" to="/import-ai">Import AI</Link></li>
                                <li><Link className="nav-link" to="/import-gemini">Import AI Gemini</Link></li>
                                <li>
                                <button
                                    className="logout-btn"
                                    onClick={logout}
                                >
                                    Logout
                                </button>
                            </li>
                            </>
                            
                        ) : (
                            <>
                                <li>
                                    <Link to="/">Home</Link>
                                </li>
                                <li>
                                <Link to="/login" className="login-btn">
                                    Login
                                </Link>
                            </li>
                            </>
                        )}
                    </ul>
                </nav>
            </div>
        </header>
    );
};

const mapStateToProps = (state) => ({
    isAuthenticated: state.AuthReducer.isAuthenticated,
});

export default connect(mapStateToProps, { logout })(Navbar);