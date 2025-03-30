import React, { useState, useContext, useEffect } from 'react';
import { Form, Button, Alert, Card, Row, Col } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { Formik } from 'formik';
import * as Yup from 'yup';
import AuthContext from '../utils/AuthContext';
import axios from 'axios';

// Validation schema
const registerSchema = Yup.object().shape({
  name: Yup.string().required('Name is required'),
  email: Yup.string().email('Invalid email address').required('Email is required'),
  password: Yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
  confirmPassword: Yup.string().oneOf([Yup.ref('password')], 'Passwords must match').required('Confirm password is required'),
  phoneNumber: Yup.string().matches(/^[0-9]+$/, 'Phone number must contain only digits').required('Phone number is required'),
  role: Yup.string().oneOf(['household', 'leader', 'admin'], 'Invalid role selected').required('Please select a role'),
  zoneId: Yup.string().when('role', {
    is: 'leader',
    then: () => Yup.string().required('Please select a zone'),
  }),
  householdId: Yup.string().when('role', {
    is: 'household',
    then: () => Yup.string().required('Please select a household'),
  }),
  adminCode: Yup.string().when('role', {
    is: 'admin',
    then: () => Yup.string().required('Admin registration code is required'),
  }),
});

const Register = () => {
  const { register } = useContext(AuthContext);
  const [registerError, setRegisterError] = useState(null);
  const [zones, setZones] = useState([]);
  const [households, setHouseholds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedZone, setSelectedZone] = useState('');
  const navigate = useNavigate();

  // Fetch zones on component mount
  useEffect(() => {
    let isMounted = true;
    const fetchZones = async () => {
      try {
        setLoading(true);
        const zonesRes = await axios.get('/api/nyumbakumi/zones/public');
        if (isMounted) {
          setZones(zonesRes.data.data || []);
        }
      } catch (err) {
        if (isMounted) {
          setRegisterError('Error loading zones: ' + (err.response?.data?.message || err.message));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchZones();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch households when zone is selected
  useEffect(() => {
    let isMounted = true;
    const fetchHouseholds = async () => {
      if (!selectedZone) {
        setHouseholds([]);
        return;
      }
      try {
        setLoading(true);
        const householdsRes = await axios.get(`/api/households/public?zoneId=${selectedZone}`);
        if (isMounted) {
          setHouseholds(householdsRes.data.data || []);
        }
      } catch (err) {
        if (isMounted) {
          setRegisterError('Error loading households: ' + (err.response?.data?.message || err.message));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchHouseholds();
    return () => {
      isMounted = false;
    };
  }, [selectedZone]);

  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      setRegisterError(null);
      const { confirmPassword, ...userData } = values;
      
      // Ensure both zoneId and householdId are included for household members
      if (values.role === 'household' && (!values.zoneId || !values.householdId)) {
        setRegisterError('Please select both zone and household');
        setSubmitting(false);
        return;
      }

      // Ensure zoneId is included for leaders
      if (values.role === 'leader' && !values.zoneId) {
        setRegisterError('Please select a zone');
        setSubmitting(false);
        return;
      }

      // Ensure admin code is included for admin registration
      if (values.role === 'admin' && !values.adminCode) {
        setRegisterError('Please provide the admin registration code');
        setSubmitting(false);
        return;
      }

      const res = await register(userData);
      if (res.success) {
        // Show success message with password
        alert(`Registration successful! Your password is: ${res.password}\nPlease save this password for future reference.`);
        // Navigate to home/dashboard
        navigate('/');
      } else {
        setRegisterError(res.error || 'Registration failed. Please try again.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setRegisterError(
        error.response?.data?.message || 
        error.message || 
        'An unexpected error occurred. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-form-container" style={{ maxWidth: '600px' }}>
      <Card className="border-0 shadow-sm">
        <Card.Body className="p-4">
          <h2 className="text-center mb-4">Register Account</h2>
          
          {registerError && <Alert variant="danger" onClose={() => setRegisterError(null)} dismissible>{registerError}</Alert>}

          <Formik
            initialValues={{
              name: '',
              email: '',
              password: '',
              confirmPassword: '',
              phoneNumber: '',
              role: '',
              zoneId: '',
              householdId: '',
              adminCode: '',
            }}
            validationSchema={registerSchema}
            onSubmit={handleSubmit}
            validateOnMount={false}
            validateOnChange={true}
            validateOnBlur={true}
          >
            {({ values, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting, setFieldValue }) => (
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>Full Name</Form.Label>
                  <Form.Control
                    type="text"
                    name="name"
                    placeholder="Enter your full name"
                    value={values.name}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    isInvalid={touched.name && errors.name}
                  />
                  <Form.Control.Feedback type="invalid">{errors.name}</Form.Control.Feedback>
                </Form.Group>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Email</Form.Label>
                      <Form.Control
                        type="email"
                        name="email"
                        placeholder="Enter email"
                        value={values.email}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        isInvalid={touched.email && errors.email}
                      />
                      <Form.Control.Feedback type="invalid">{errors.email}</Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Phone Number</Form.Label>
                      <Form.Control
                        type="text"
                        name="phoneNumber"
                        placeholder="Enter phone number"
                        value={values.phoneNumber}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        isInvalid={touched.phoneNumber && errors.phoneNumber}
                      />
                      <Form.Control.Feedback type="invalid">{errors.phoneNumber}</Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                </Row>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Password</Form.Label>
                      <Form.Control
                        type="password"
                        name="password"
                        placeholder="Enter password"
                        value={values.password}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        isInvalid={touched.password && errors.password}
                      />
                      <Form.Control.Feedback type="invalid">{errors.password}</Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Confirm Password</Form.Label>
                      <Form.Control
                        type="password"
                        name="confirmPassword"
                        placeholder="Confirm password"
                        value={values.confirmPassword}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        isInvalid={touched.confirmPassword && errors.confirmPassword}
                      />
                      <Form.Control.Feedback type="invalid">{errors.confirmPassword}</Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-3">
                  <Form.Label>Role</Form.Label>
                  <Form.Select name="role" value={values.role} onChange={handleChange} onBlur={handleBlur} isInvalid={touched.role && errors.role}>
                    <option value="">Select a role</option>
                    <option value="household">Household Member</option>
                    <option value="leader">Nyumba Kumi Leader</option>
                    <option value="admin">Administrator</option>
                  </Form.Select>
                  <Form.Control.Feedback type="invalid">{errors.role}</Form.Control.Feedback>
                </Form.Group>

                {values.role === 'admin' && (
                  <Form.Group className="mb-3">
                    <Form.Label>Admin Registration Code</Form.Label>
                    <Form.Control
                      type="password"
                      name="adminCode"
                      placeholder="Enter admin registration code"
                      value={values.adminCode}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      isInvalid={touched.adminCode && errors.adminCode}
                    />
                    <Form.Control.Feedback type="invalid">{errors.adminCode}</Form.Control.Feedback>
                  </Form.Group>
                )}

                {(values.role === 'leader' || values.role === 'household') && (
                  <Form.Group className="mb-3">
                    <Form.Label>Zone</Form.Label>
                    <Form.Select 
                      name="zoneId" 
                      value={values.zoneId} 
                      onChange={(e) => {
                        handleChange(e);
                        // Reset household when zone changes
                        setSelectedZone(e.target.value);
                        setFieldValue('householdId', '');
                      }}
                      isInvalid={touched.zoneId && errors.zoneId}
                    >
                      <option value="">Select a zone</option>
                      {zones.map(zone => (
                        <option key={zone._id} value={zone._id}>
                          {zone.name} ({zone.location})
                        </option>
                      ))}
                    </Form.Select>
                    <Form.Control.Feedback type="invalid">{errors.zoneId}</Form.Control.Feedback>
                  </Form.Group>
                )}

                {values.role === 'household' && values.zoneId && (
                  <Form.Group className="mb-3">
                    <Form.Label>Household</Form.Label>
                    <Form.Select
                      name="householdId"
                      value={values.householdId}
                      onChange={handleChange}
                      isInvalid={touched.householdId && errors.householdId}
                    >
                      <option value="">Select a household</option>
                      {loading ? (
                        <option>Loading households...</option>
                      ) : households.length === 0 ? (
                        <option>No households available in this zone</option>
                      ) : (
                        households.map(h => (
                          <option key={h._id} value={h._id}>
                            {h.address} ({h.houseNumber || 'No number'})
                          </option>
                        ))
                      )}
                    </Form.Select>
                    <Form.Control.Feedback type="invalid">{errors.householdId}</Form.Control.Feedback>
                  </Form.Group>
                )}

                <Row className="mt-4">
                  <Col>
                    <Button 
                      type="submit" 
                      variant="primary" 
                      className="w-100" 
                      disabled={isSubmitting || (Object.keys(touched).length > 0 && Object.keys(errors).length > 0)}
                    >
                      {isSubmitting ? 'Creating Account...' : 'Register'}
                    </Button>
                  </Col>
                </Row>

                <Row className="mt-3">
                  <Col className="text-center">
                    Already have an account? <Link to="/login">Login</Link>
                  </Col>
                </Row>
              </Form>
            )}
          </Formik>
        </Card.Body>
      </Card>
    </div>
  );
};

export default Register;
