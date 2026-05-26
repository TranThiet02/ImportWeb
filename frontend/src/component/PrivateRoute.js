import React from 'react'
import { Navigate } from 'react-router-dom'
import { connect } from 'react-redux'

const PrivateRoute = ({ isAuthenticated, children }) => {
    if (!isAuthenticated) {
        return <Navigate to="/login/" />
    }
    return children
}

const mapStateToProps = (state) => ({
    isAuthenticated: state.AuthReducer.isAuthenticated
})

export default connect(mapStateToProps)(PrivateRoute)