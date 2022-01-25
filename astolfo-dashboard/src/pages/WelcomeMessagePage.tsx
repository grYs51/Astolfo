import {
  Button,
  Container,
  Flex,
  Page,
  Select,
  TextArea,
  Title,
} from "../utils/styles";

export const WelcomeMessagePage = () => {
  return (
    <Page>
      <Container>
        <Title>Update Welcome Message</Title>
        <div>
          <section>
            <div>
              <label>Current Channel</label>
            </div>
            <Select style={{ width: "100%", margin: "10px 0" }}>
              <option disabled>Please Select a Channel</option>
              <option>123</option>
              <option>124</option>
              <option>125</option>
              <option>126</option>
            </Select>
          </section>
          <section style={{ margin: "10px 0" }}>
            <div>
              <label htmlFor="message">Current Message</label>
            </div>
            <TextArea id="message" style={{ marginTop: "10px" }} />
          </section>
          <Flex justifyContent="flex-end">
            <Button
              variant="secondary"
              style={{
                marginRight: "8px",
              }}
            >
              Reset
            </Button>
            <Button variant="primary">Save</Button>
          </Flex>
        </div>
      </Container>
    </Page>
  );
};
