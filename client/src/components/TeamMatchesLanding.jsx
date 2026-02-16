// src/components/TeamMatchesLanding.jsx
import React from 'react';
import { Card, Button, Row, Col, Typography, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { OrderedListOutlined, RetweetOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

const TeamMatchesLanding = () => {
    const navigate = useNavigate();

    const handleSetMatchClick = () => {
        console.log("Set Match Type card clicked. Navigating to /team-matches/setup-set");
        navigate('/team-matches/setup-set');
    };

    const handleRelayMatchClick = () => {
        console.log("Relay Match Type card clicked. Navigating to /team-matches/setup-relay");
        navigate('/team-matches/setup-relay');
    };

    return (
        <Card title={<Title level={1}>Team Matches</Title>} style={{ textAlign: 'center'}}>
            <h2 style={{ color: '#546f8d'}}>
                Select the type of team match you want to set up.
            </h2>
            <Row gutter={[16, 16]} justify="center" style={{ marginTop: 24 }}>
                <Col xs={24} md={10}>
                    <Card
                        hoverable
                        onClick={handleSetMatchClick}
                        style={{ textAlign: 'center', minHeight: 150, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
                    >
                        <Space direction="vertical" align="center" size="large">
                            <OrderedListOutlined style={{ fontSize: '150px', color: '#d728dd' }} />
                            <Title level={4}>Set Match Type</Title>
                            <h3 style={{ color: '#ee3535'}}>Traditional format with a series of sets.</h3>
                        </Space>
                    </Card>
                </Col>
                <Col xs={24} md={10}>
                    <Card
                        hoverable
                        onClick={handleRelayMatchClick}
                        style={{ textAlign: 'center', minHeight: 150, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
                    >
                        <Space direction="vertical" align="center" size="large">
                            <RetweetOutlined style={{ fontSize: '150px', color: '#52c41a' }} />
                            <Title level={4}>Relay Match Type</Title>
                            <h3 style={{ color: '#ee3535'}}>Players compete in a continuous relay format.</h3>
                        </Space>
                    </Card>
                </Col>
            </Row>
        </Card>
    );
};

export default TeamMatchesLanding;