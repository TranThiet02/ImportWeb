import React from "react";
import { connect } from "react-redux";
import { Link } from "react-router-dom";


const Home = ({ user }) => {
    return (
        <section className="hero-section">
            <div className="container">
                <div className="hero-content">
                    <span className="hero-badge">
                        AI Accounting Automation Platform
                    </span>
                    <h1>
                        Auto Input Invoices & Accounting Data
                        <br />
                        For Accounting Companies
                    </h1>
                    {user ? (
                        <p>
                            Welcome,
                            <span className="user-email">
                                {" "} {user.email}
                            </span>
                        </p>
                    ) : (
                        <p>
                            Upload invoices, receipts, and documents.
                            The system reads data automatically and puts it into accounting software.
                        </p>
                    )}
                    <div className="hero-buttons">
                        {user ? (
                            <button className="primary-btn">
                                Start Now
                            </button>
                        ) : (
                            <Link to="/login" className="primary-btn" style={{ textDecoration: "none" }}>
                                Start Now
                            </Link>
                        )}
                        <button className="secondary-btn">
                            Learn More
                        </button>
                    </div>

                </div>

            </div>
        </section>
    );
};

const mapStateToProps = (state) => ({
    user: state.AuthReducer.user,
});

export default connect(mapStateToProps)(Home);