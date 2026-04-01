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
  password: Yup.string().required('Password is required').min(6, 'Password must be at least 6 characters'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password'), null], 'Passwords must match')
    .required('Please confirm your password'),
  phoneNumber: Yup.string().required('Phone number is required').matches(/^[0-9]+$/, 'Phone number must contain only digits'),
  role: Yup.string().required('Please select a role').oneOf(['household', 'leader', 'admin'], 'Invalid role selected'),
  zoneId: Yup.string().when('role', {
    is: 'leader',
    then: () => Yup.string().required('Please select a zone'),
    otherwise: () => Yup.string().notRequired()
  }),
  householdId: Yup.string().when('role', {
    is: 'household',
    then: () => Yup.string().required('Please select a household'),
    otherwise: () => Yup.string().notRequired()
  }),
  adminCode: Yup.string().when('role', {
    is: 'admin',
    then: () => Yup.string().required('Admin registration code is required'),
    otherwise: () => Yup.string().notRequired()
  })
});

const Register = () => {
  const { register, isAuthenticated, error, clearErrors } = useContext(AuthContext);
  const [registerError, setRegisterError] = useState(null);
  const [zones, setZones] = useState([]);
  const [households, setHouseholds] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
    if (error) {
      setRegisterError(error);
      clearErrors();
    }
    fetchZones();
    fetchHouseholds();
  }, [isAuthenticated, error]);

  // Fetch available zones
  const fetchZones = async () => {
    console.log('Fetching zones...'); // Debugging
    try {
      setLoading(true);
      const response = await axios.get('/api/nyumbakumi/zones/public');
      setZones(response.data.data || []);
      setLoading(false);
    } catch (err) {
      setRegisterError('Error fetching zones. Please try again.');
      setLoading(false);
    }
  };

  // Fetch available households
  const fetchHouseholds = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/households/public');
      setHouseholds(response.data.data || []);
      setLoading(false);
    } catch (err) {
      setRegisterError('Error fetching households. Please try again.');
      setLoading(false);
    }
  };

  const handleSubmit = async (values, { setSubmitting }) => {
    console.log('Submitting Data:', values); // Debugging
    setRegisterError(null);
    
    try {
        let zoneName = '';
        let householdName = '';

        if (values.role === 'leader') {
            const selectedZone = zones.find(zone => zone._id === values.zoneId);
            zoneName = selectedZone ? selectedZone.name : '';
        }

        if (values.role === 'household') {
            const selectedHousehold = households.find(hh => hh._id === values.householdId);
            householdName = selectedHousehold ? selectedHousehold.name : '';
        }

        const { confirmPassword, ...userData } = values;
        const userPayload = { ...userData, zoneName, householdName };

        const res = await register(userPayload);

        if (!res.success) {
            console.error('Registration failed:', res.error); // More detailed error logging
            setRegisterError(res.error);
        } else {
            console.log('Registration successful:', res); // Log success
            navigate('/dashboard');
        }
    } catch (error) {
        console.error('Registration failed:', error); // Log the error
        setRegisterError('Registration failed. Please try again.');
    } finally {
        setSubmitting(false); // Ensure button is re-enabled
    }
};
  
  return (
    <div className="auth-form-container" style={{ maxWidth: '600px' }}>
      <Card className="border-0 shadow-sm">
        <Card.Body className="p-4">
          <h2 className="text-center mb-4">Register Account</h2>

          {registerError && (
            <Alert variant="danger" onClose={() => setRegisterError(null)} dismissible>
              {registerError}
            </Alert>
          )}

          <Formik
            initialValues={{
              name: '',
              email: '',
              password: '',
              confirmPassword: '',
              phoneNumber: '',
              role: 'household',
              zoneId: '',
              householdId: '',
              adminCode: ''
            }
        
          }
            validationSchema={registerSchema}
            onSubmit={handleSubmit}
            
          >
            {({ values, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting }) => (
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>Full Name</Form.Label>
                  <Form.Control type="text" name="name" value={values.name} onChange={handleChange} onBlur={handleBlur} isInvalid={touched.name && errors.name} />
                  <Form.Control.Feedback type="invalid">{errors.name}</Form.Control.Feedback>
                </Form.Group>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Email</Form.Label>
                      <Form.Control type="email" name="email" value={values.email} onChange={handleChange} onBlur={handleBlur} isInvalid={touched.email && errors.email} />
                      <Form.Control.Feedback type="invalid">{errors.email}</Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Phone Number</Form.Label>
                      <Form.Control type="text" name="phoneNumber" value={values.phoneNumber} onChange={handleChange} onBlur={handleBlur} isInvalid={touched.phoneNumber && errors.phoneNumber} />
                      <Form.Control.Feedback type="invalid">{errors.phoneNumber}</Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                  <Form.Group className="mb-3">
  <Form.Label>Password</Form.Label>
  <Form.Control 
    type="password" 
    name="password" 
    value={values.password} 
    onChange={handleChange} 
    onBlur={handleBlur} 
    isInvalid={touched.password && errors.password} 
  />
  <Form.Control.Feedback type="invalid">{errors.password}</Form.Control.Feedback>
</Form.Group>

<Form.Group className="mb-4">
  <Form.Label>Confirm Password</Form.Label>
  <Form.Control 
    type="password" 
    name="confirmPassword" 
    value={values.confirmPassword} 
    onChange={handleChange} 
    onBlur={handleBlur} 
    isInvalid={touched.confirmPassword && errors.confirmPassword} 
  />
  <Form.Control.Feedback type="invalid">{errors.confirmPassword}</Form.Control.Feedback>
</Form.Group>
</Col>
                </Row>

                <Form.Group className="mb-4">
                  <Form.Label>Role</Form.Label>
                  <Form.Select name="role" value={values.role} onChange={handleChange} onBlur={handleBlur} isInvalid={touched.role && errors.role}>
                    <option value="household">Household Member</option>
                    <option value="leader">Nyumba Kumi Leader</option>
                    <option value="admin">Administrator</option>
                  </Form.Select>
                  <Form.Control.Feedback type="invalid">{errors.role}</Form.Control.Feedback>
                </Form.Group>

                {values.role === 'leader'|| values.role === 'household' && (
                  <Form.Group className="mb-3">
                    <Form.Label>Select Zone</Form.Label>
                    <Form.Select name="zoneId" value={values.zoneId} onChange={handleChange} onBlur={handleBlur} isInvalid={touched.zoneId && errors.zoneId}>
                      <option value="">Choose a zone</option>
                      {zones.map(zone => (
                        <option key={zone._id} value={zone._id}>{zone.name}</option>
                      ))}
                    </Form.Select>
                    <Form.Control.Feedback type="invalid">{errors.zoneId}</Form.Control.Feedback>
                  </Form.Group>
                )}

                {values.role === 'household' && (
                  <Form.Group className="mb-3">
                    <Form.Label>Select Household</Form.Label>
                    <Form.Select name="householdId" value={values.householdId} onChange={handleChange} onBlur={handleBlur} isInvalid={touched.householdId && errors.householdId}>
                      <option value="">Choose a household</option>
                      {households.map(hh => (
                        <option key={hh._id} value={hh._id}>{hh.houseNumber}</option>
                      ))}
                    </Form.Select>
                    <Form.Control.Feedback type="invalid">{errors.householdId}</Form.Control.Feedback>
                  </Form.Group>
                )}

                {values.role === 'admin' && (
                  <Form.Group className="mb-3">
                    <Form.Label>Admin Code</Form.Label>
                    <Form.Control type="text" name="adminCode" value={values.adminCode} onChange={handleChange} onBlur={handleBlur} isInvalid={touched.adminCode && errors.adminCode} />
                    <Form.Control.Feedback type="invalid">{errors.adminCode}</Form.Control.Feedback>
                  </Form.Group>
                )}

                <Button 
                  variant="primary"
                  type="submit"
                  className="w-100"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Creating Account...' : 'Register'}
                </Button>
              </Form>
            )}
          </Formik>
        </Card.Body>
      </Card>
    </div>
  );
};

export default Register;
