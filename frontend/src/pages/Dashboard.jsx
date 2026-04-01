import React, { useContext, useEffect, useState } from 'react';
import { Card, Row, Col, Spinner, Alert } from 'react-bootstrap';
import { AuthContext } from '../utils/AuthContext';
import axios from 'axios';

const Dashboard = () => {
  const { user, token } = useContext(AuthContext);
  const [householdData, setHouseholdData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHouseholdData = async () => {
      try {
        setLoading(true);
        const response = await axios.get("http://localhost:5000/api/households/my-household", {
          headers: { Authorization: `Bearer ${token}` }
        });
        setHouseholdData(response.data.data);
      } catch (err) {
        setError('Error fetching household data: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchHouseholdData();
  }, [token]);

  if (loading) return <Spinner animation="border" role="status"><span className="visually-hidden">Loading...</span></Spinner>;
  if (error) return <Alert variant="danger">{error}</Alert>;

  return (
    <div className="dashboard">
      <h2>Welcome, {user.name}</h2>
      {householdData ? (
        <Row>
          <Col md={6}>
            <Card>
              <Card.Header>Household Information</Card.Header>
              <Card.Body>
                <h5>{householdData.name}</h5>
                <p>Zone: {householdData.nyumbaKumiZone ? householdData.nyumbaKumiZone.name : 'No zone'}</p>
                <h6>Members:</h6>
                <ul>
                  {householdData.members.map(member => (
                    <li key={member._id}>{member.name} - {member.email}</li>
                  ))}
                </ul>
              </Card.Body>
            </Card>
          </Col>
          {/* Additional sections for tasks and alerts can be added here */}
        </Row>
      ) : (
        <p>You are not assigned to any household.</p>
      )}
    </div>
  );
};

export default Dashboard;