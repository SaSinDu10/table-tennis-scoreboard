// src/components/PlayerForm.jsx
import React, { useState } from 'react';
import { Form, Input, Select, Button, Upload, message, Typography, Card } from 'antd'; // Ensure Card is imported
import { UploadOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Option } = Select;
const { Title } = Typography;

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const PlayerForm = ({ onPlayerAdded }) => {
    const [form] = Form.useForm();
    const [fileList, setFileList] = useState([]);
    const [uploading, setUploading] = useState(false);

    // --- Handlers (handleFinish, handleUploadChange, beforeUpload) remain the same as before ---
    const handleFinish = async (values) => {
        setUploading(true);
        const formData = new FormData();
        formData.append('name', values.name);
        formData.append('category', values.category);
        if (fileList.length > 0 && fileList[0].originFileObj) {
            formData.append('playerImage', fileList[0].originFileObj);
        }
        try {
            const response = await axios.post(`${API_URL}/api/players`, formData);
            message.success(`Player '${response.data.name}' added successfully!`);
            form.resetFields();
            setFileList([]);
            if (onPlayerAdded) {
                onPlayerAdded(response.data);
            }
        } catch (error) {
            console.error("Error adding player:", error.response?.data || error.message);
            let errorMessage = 'Failed to add player.';
            if (error.response?.data?.message) {
                errorMessage = error.response.data.message;
            } else if (error.message) {
                errorMessage = error.message;
            }
            message.error(errorMessage);
        } finally {
            setUploading(false);
        }
    };
    const handleUploadChange = ({ fileList: newFileList }) => {
        setFileList(newFileList.slice(-1));
    };
    const beforeUpload = (file) => {
        const isJpgOrPngOrGif = file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/gif';
        if (!isJpgOrPngOrGif) {
            message.error('You can only upload JPG/PNG/GIF file!');
            return Upload.LIST_IGNORE; // More explicit way to reject in AntD v5+
        }
        const isLt1M = file.size / 1024 / 1024 < 1;
        if (!isLt1M) {
            message.error('Image must be smaller than 1MB!');
            return Upload.LIST_IGNORE;
        }
        // Prevent auto-upload by returning false, we handle it manually
        return false;
    };
    // --- End Handlers ---


    return (
        // Wrap the Form in a Card for visual grouping and padding
        <Card title={<Title level={2} style={{ marginBottom: 0 , textAlign: 'center'}}>Add New Player</Title>}>
            <Form
                form={form}
                layout="vertical" // Vertical layout is usually clearer for forms
                onFinish={handleFinish}
                // No extra style needed here, Card provides padding
            >
                <Form.Item
                    name="name"
                    label="Player Name" // Labels above inputs
                    rules={[{ required: true, message: 'Please input the player name!' }]}
                >
                    <Input placeholder="Enter player name" />
                </Form.Item>

                <Form.Item
                    name="category"
                    label="Category"
                    rules={[{ required: true, message: 'Please select a category!' }]}
                >
                    <Select placeholder="Select player category">
                        <Option value="Super Senior">Super Senior</Option>
                        <Option value="Senior">Senior</Option>
                        <Option value="Junior">Junior</Option>
                    </Select>
                </Form.Item>

                <Form.Item
                    name="photo"
                    label="Player Photo"
                    help="Optional. JPG/PNG/GIF < 1MB" // Help text below
                >
                    <Upload
                        listType="picture-card" // Use picture-card for a better visual
                        fileList={fileList}
                        beforeUpload={beforeUpload}
                        onChange={handleUploadChange}
                        onRemove={() => setFileList([])} // Allow removal
                        maxCount={1}
                        accept=".jpg,.jpeg,.png,.gif"
                    >
                        {/* Show upload button only if no file is selected */}
                        {fileList.length < 1 && <div><UploadOutlined /><div style={{ marginTop: 8 }}>Upload</div></div>}
                    </Upload>
                </Form.Item>

                <Form.Item
                    // No label needed for the submit button container
                >
                    <Button type="primary" htmlType="submit" loading={uploading} block>
                        {uploading ? 'Adding...' : 'Add Player'}
                    </Button>
                </Form.Item>
            </Form>
        </Card>
    );
};

export default PlayerForm;