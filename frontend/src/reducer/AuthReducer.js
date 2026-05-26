import TYPE from "./Type";

const initialState = {
    access: localStorage.getItem('access'),
    isAuthenticated: !!localStorage.getItem('access'),
    user: null,
    message: ""
}

const AuthReducer = (state=initialState, action) => {
    const {type, payload} = action;
    switch(type){
        case TYPE.LOGIN_SUCCESS:
            localStorage.setItem('access', payload.access);
            localStorage.setItem('refresh_token', payload.refresh)
            return{
                ...state,
                access: payload.access, 
                isAuthenticated: true,
                user: payload.user,
                message: 'Login has successed'
            }
        case TYPE.LOGIN_FAIL:
            localStorage.removeItem('access');
            return{
                ...state,
                access: null,
                isAuthenticated: false,
                user: null,
                message: 'Login has failed'
            }
        case TYPE.VERIFY_SUCCESS:
            return{
                ...state,
                isAuthenticated: true
            }
        case TYPE.VERIFY_FAIL:
            return{
                ...state,
                isAuthenticated: false
            }
        case TYPE.GET_USER_SUCCESS:
            return{
                ...state,
                user: payload
            }
        case TYPE.GET_USER_FAIL:
            return{
                ...state,
                user: null
            }
        case TYPE.REFRESH_SUCCESS:
            localStorage.setItem('access', payload.access);
            return{
                ...state,
                access: payload.access,
                isAuthenticated: true,
                message: 'Refresh token success'
            }
        case TYPE.REFRESH_FAIL:
            localStorage.removeItem('access');
            return{
                ...state,
                access: null,
                isAuthenticated: false,
                user: null,
                message: 'Refresh token fail'
            }
        case TYPE.LOGOUT:
            localStorage.removeItem('access');
            return {
                ...state,
                access: null,
                isAuthenticated: false,
                user: null,
                message: "User has logged out"
            }
        case TYPE.CLOSE_ALERT:
            return {
                ...state,
                message: ""
            }
        case TYPE.GUEST_VIEW:
            return {
                ...state
            }
        default:
            return state;
    }
}

export default AuthReducer;