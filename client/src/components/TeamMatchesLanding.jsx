// src/components/TeamMatchesLanding.jsx
import React from 'react';
import { Card, Button, Row, Col, Typography, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { OrderedListOutlined, RetweetOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography; // Assuming you destructured Text

const TeamMatchesLanding = () => {
    const navigate = useNavigate();

    const handleSetMatchClick = () => {
        console.log("Set Match Type card clicked. Navigating to /team-matches/setup-set"); // <-- ADD LOG
        navigate('/team-matches/setup-set');
    };

    const handleRelayMatchClick = () => {
        console.log("Relay Match Type card clicked. Navigating to /team-matches/setup-relay"); // <-- ADD LOG
        navigate('/team-matches/setup-relay');
    };

    return (
        <Card title={<Title level={3}>Team Matches</Title>}>
            <Paragraph>
                Select the type of team match you want to set up.
            </Paragraph>
            <Row gutter={[16, 16]} justify="center" style={{ marginTop: 24 }}>
                <Col xs={24} md={10}>
                    <Card
                        hoverable
                        onClick={handleSetMatchClick} // Use the handler
                        style={{ textAlign: 'center', minHeight: 150, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
                    >
                        <Space direction="vertical" align="center" size="large">
                            <OrderedListOutlined style={{ fontSize: '48px', color: '#1677ff' }} />
                            <Title level={4}>Set Match Type</Title>
                            <Text type="secondary">Traditional format with a series of sets.</Text>
                        </Space>
                    </Card>
                </Col>
                <Col xs={24} md={10}>
                    <Card
                        hoverable
                        onClick={handleRelayMatchClick} // Use the handler
                        style={{ textAlign: 'center', minHeight: 150, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
                    >
                        <Space direction="vertical" align="center" size="large">
                            <RetweetOutlined style={{ fontSize: '48px', color: '#52c41a' }} />
                            <Title level={4}>Relay Match Type</Title>
                            <Text type="secondary">Players compete in a continuous relay format. (Coming Soon)</Text>
                        </Space>
                    </Card>
                </Col>
            </Row>
        </Card>
    );
};

export default TeamMatchesLanding;